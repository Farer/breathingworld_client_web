'use strict';
export class PixiManager {
    constructor(targetElement, worker) {
        if (!targetElement) throw new Error("invalid targetElement");
        this.worker = worker;
        this.isReady = false;
        this.app = null;
        this.currentScale = 128;

        // ✅ species별 캐시
        this._animalCache = {};

        this.textures = {
            ground: [], weed: [], shadow: null, trees: [],
            rabbit: {}, wolf: {}, eagle: {}
        };

        this.sharedInterpFilters = {}; // species별 공유 필터

        this._init(targetElement);
    }

    async _init(targetElement) {
        this.app = new PIXI.Application();
        await this.app.init({ backgroundAlpha: 0, resizeTo: window });
        targetElement.appendChild(this.app.view);

        this.groundLayer = new PIXI.Container();
        this.shadowLayer = new PIXI.Container(); this.shadowLayer.sortableChildren = true;
        this.weedLayer = new PIXI.Container(); this.weedLayer.sortableChildren = true;
        this.entityLayer = new PIXI.Container(); this.entityLayer.sortableChildren = true;
        this.app.stage.addChild(this.groundLayer, this.weedLayer, this.shadowLayer, this.entityLayer);

        await this.loadAssets();
        await this.loadAnimalFrames('rabbit');
        await this.loadAnimalFrames('wolf');
        this.isReady = true;
    }

    async loadAssets() {
        const g = new PIXI.Graphics();
        g.beginFill(0x000000, 0.2);
        g.drawEllipse(0, 0, 400, 200);
        g.endFill();
        const bounds = new PIXI.Rectangle(-400, -200, 800, 400);
        this.textures.shadow = this.app.renderer.generateTexture(g, { region: bounds });

        const manifest = {
            bundles: [{
                name: 'game-assets',
                assets: {
                    'groundSheet': '/img/sprites/sprite_ground_with_droppings_rgba_opti.png',
                    'weedSheet': '/img/sprites/sprite_weed_512_opti.png',
                    'wolfSheet': '/img/sprites/sprite_wolf_256_tiny.png'
                }
            }]
        };

        const totalTreeStages = 12;
        for (let i = 0; i < totalTreeStages; i++)
            manifest.bundles[0].assets[`treeStage${i}`] = `img/tree_${i}_tiny.png`;

        await PIXI.Assets.init({ manifest });
        const loaded = await PIXI.Assets.loadBundle('game-assets');

        for (let i = 0; i < totalTreeStages; i++)
            this.textures.trees.push(loaded[`treeStage${i}`]);
        this.textures.ground = this._parseGridSpriteSheet(loaded.groundSheet, 128, 128, 4, 4);
        this.textures.weed = this._parseGridSpriteSheet(loaded.weedSheet, 512, 512, 4, 17);
        this.textures.wolf = this._parseAnimalSheet(loaded.wolfSheet, 256, {
            idle: 60, run: 41, howl: 60
        });
    }

    // ✅ 종(species)별 로드
    async loadAnimalFrames(species) {
        const scaleDir = `${this.currentScale}`;
        this._animalCache[species] = this._animalCache[species] || {};
        if (this._animalCache[species][scaleDir]) {
            this.textures[species] = this._animalCache[species][scaleDir];
            return;
        }

        if (species === 'rabbit') {
            await this._loadDirectionalFrames(species, ['idle_1', 'run_1']);
        } else if (species === 'eagle') {
            await this._loadDirectionalFrames(species, ['idle', 'fly', 'attack']);
        } else if (species === 'wolf') {
            // wolf는 sprite sheet 기반이므로 이미 loadAssets에서 처리됨
            return;
        }

        this._animalCache[species][scaleDir] = this.textures[species];
        console.log(`✅ ${species} frames cached for scale ${scaleDir}`);
    }

    // ✅ 방향별 WebP 프레임 로더
    async _loadDirectionalFrames(species, animations) {
        const scaleDir = `${this.currentScale}`;
        const basePath = `/img/sprites/${species}/${scaleDir}`;
        const dirs = Array.from({ length: 16 }, (_, i) => `direction_${i.toString().padStart(2, '0')}`);
        this.textures[species] = {};

        for (const anim of animations) {
            this.textures[species][anim] = {};
            for (const dir of dirs) {
                const path = `${basePath}/${anim}/${dir}`;
                const frames = [];
                for (let i = 0; i < 100; i++) {
                    const num = i.toString().padStart(4, '0');
                    const url = `${path}/webp/frame_${num}.webp`;
                    try {
                        const img = await this._decodeImage(url);
                        frames.push(PIXI.Texture.from(img));
                    } catch {
                        break;
                    }
                }
                if (frames.length > 0) this.textures[species][anim][dir] = frames;
            }
        }
    }

    async _decodeImage(url) {
        if (!this.worker) return await createImageBitmap(await (await fetch(url)).blob());
        return new Promise((resolve, reject) => {
            const id = Math.random().toString(36).slice(2);
            const onMsg = (e) => {
                if (e.data && e.data.id === id) {
                    this.worker.removeEventListener('message', onMsg);
                    if (e.data.error) reject(e.data.error);
                    else resolve(e.data.bitmap);
                }
            };
            this.worker.addEventListener('message', onMsg);
            this.worker.postMessage({ type: 'decode', url, id });
        });
    }

    _parseAnimalSheet(sheetTexture, frameSize, animationConfig) {
        const animations = {};
        let currentY = 0;
        for (const [name, count] of Object.entries(animationConfig)) {
            animations[name] = this._parseRowSpriteSheet(sheetTexture, frameSize, frameSize, currentY, count);
            currentY += frameSize;
        }
        return animations;
    }

    _parseRowSpriteSheet(texture, fw, fh, yOffset, count) {
        const frames = [];
        for (let i = 0; i < count; i++) {
            const rect = new PIXI.Rectangle(i * fw, yOffset, fw, fh);
            frames.push(new PIXI.Texture({ source: texture.source, frame: rect }));
        }
        return frames;
    }

    _parseGridSpriteSheet(texture, fw, fh, cols, total) {
        const frames = [];
        for (let i = 0; i < total; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const rect = new PIXI.Rectangle(col * fw, row * fh, fw, fh);
            frames.push(new PIXI.Texture({ source: texture.source, frame: rect }));
        }
        return frames;
    }

    createGround(stage) {
        const g = new PIXI.Sprite(this.textures.ground[stage]);
        g.anchor.set(0);
        g.entityType = 'ground';
        this.groundLayer.addChild(g);
        return g;
    }

    createWeed(stage) {
        const w = new PIXI.Sprite(this.textures.weed[stage]);
        w.anchor.set(0.5, 1);
        w.entityType = 'weed';
        this.weedLayer.addChild(w);
        return w;
    }

    createTree(stage) {
        const t = new PIXI.Sprite(this.textures.trees[stage]);
        t.anchor.set(0.5, 1);
        t.entityType = 'tree';
        this.entityLayer.addChild(t);
        this._addShadow(t, -250, 1.4);
        return t;
    }

    // ✅ 통합 동물 생성기
    createAnimal(name, anim) {
        const t = this.textures[name];
        if (!t) return null;
        if (name === 'rabbit') return this._createRabbit(anim);
        if (name === 'wolf') return this._createWolf(anim);
        return this._createGeneric(name, anim);
    }

    _createRabbit(animKey) {
        const anim = animKey.endsWith('_1') ? animKey : `${animKey}_1`;
        const dirs = this.textures.rabbit[anim];
        const validDirs = Object.keys(dirs).filter(k => dirs[k]?.length);
        const dir = validDirs[Math.floor(Math.random() * validDirs.length)];
        const sprite = new PIXI.AnimatedSprite(dirs[dir]);
        sprite.entityType = 'rabbit';
        sprite.currentDir = dir;
        sprite.anchor.set(0.5, 1);
        sprite.animationSpeed = anim === 'idle_1' ? 0.37 : 0.55;
        sprite.play();

        if (window.FrameInterpFilter && anim === 'idle_1') {
            if (!this.sharedInterpFilters.rabbit)
                this.sharedInterpFilters.rabbit = new FrameInterpFilter();
            const f = this.sharedInterpFilters.rabbit;
            sprite.filters = [f];
            this._applyInterpTick(sprite, f);
        } else sprite._tick = d => sprite.update(d);

        this.app.ticker.add(sprite._tick);
        sprite.on('destroyed', () => this.app.ticker.remove(sprite._tick));

        this._addShadow(sprite, -130, 0.4);
        this.entityLayer.addChild(sprite);
        sprite.animations = this.textures.rabbit;
        return sprite;
    }

    _createWolf(anim) {
        const frames = this.textures.wolf[anim];
        const s = new PIXI.AnimatedSprite(frames);
        s.entityType = 'wolf';
        s.anchor.set(0.5, 1);
        s.animationSpeed = 0.25;
        s.play();
        this._addShadow(s, -20, 0.3);
        this.entityLayer.addChild(s);
        s.animations = this.textures.wolf;
        return s;
    }

    _createGeneric(name, anim) {
        const dirs = this.textures[name][anim];
        const valid = Object.keys(dirs).filter(k => dirs[k]?.length);
        const dir = valid[Math.floor(Math.random() * valid.length)];
        const s = new PIXI.AnimatedSprite(dirs[dir]);
        s.entityType = name;
        s.anchor.set(0.5, 1);
        s.animationSpeed = 0.4;
        s.play();
        this._addShadow(s, -100, 0.25);
        this.entityLayer.addChild(s);
        s.animations = this.textures[name];
        return s;
    }

    _addShadow(sprite, offsetY, ratio) {
        const sh = new PIXI.Sprite(this.textures.shadow);
        sh.anchor.set(0.5);
        this.shadowLayer.addChild(sh);
        sprite.shadow = sh;
        sprite.shadowOffsetY = offsetY;
        sprite.shadowWidthRatio = ratio;
    }

    _applyInterpTick(sprite, filter) {
        setTimeout(() => {
            const tex = sprite.textures[0];
            filter.setFrames(tex, tex, 0.0);
            sprite._frameDuration = 1000 / 22;
            sprite._interpTime = 0;
            sprite.onFrameChange = (i) => {
                const next = (i + 1) % sprite.textures.length;
                filter.setFrames(sprite.textures[i], sprite.textures[next], 0.0);
                sprite._interpTime = 0;
            };
            sprite._tick = (d) => {
                const now = performance.now();
                sprite._lastTime ??= now;
                const dt = now - sprite._lastTime;
                sprite._lastTime = now;
                sprite._interpTime += dt;
                const mix = Math.min(sprite._interpTime / sprite._frameDuration, 1.0);
                filter.uniforms.uMix = mix;
                sprite.update(d);
            };
        }, 0);
    }
}
