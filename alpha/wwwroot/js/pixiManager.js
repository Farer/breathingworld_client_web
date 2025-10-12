'use strict';
export class PixiManager {
    constructor(targetElement, worker) {
        if (!targetElement) throw new Error("invalid targetElement");
        this.worker = worker;
        this.isReady = false;
        this.app = null;
        this.currentScale = 128; // ✅ 현재 스케일 상태 추가
        this._rabbitCache = {};

        this.textures = {
            ground: [], weed: [], shadow: null, trees: [],
            rabbit: {}, wolf: {}
        };

        this.groundLayer = null;
        this.shadowLayer = null;
        this.weedLayer = null;
        this.entityLayer = null;

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
        await this.loadRabbitFrames(); // ✅ 새 애니메이션 로딩
        this.isReady = true;
    }

    async loadAssets() {
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0x000000, 0.2);
        graphics.drawEllipse(0, 0, 400, 200);
        graphics.endFill();
        const bounds = new PIXI.Rectangle(-400, -200, 800, 400);
        this.textures.shadow = this.app.renderer.generateTexture(graphics, { region: bounds });

        const assetManifest = {
            bundles: [{
                name: 'game-assets',
                assets: {
                    'groundSheet': '/img/sprites/sprite_ground_with_droppings_rgba_opti.png',
                    'weedSheet': '/img/sprites/sprite_weed_512_opti.png',
                    'wolfSheet': '/img/sprites/sprite_wolf_256_tiny.png',
                },
            }],
        };

        const totalTreeStages = 12;
        for (let i = 0; i < totalTreeStages; i++) {
            assetManifest.bundles[0].assets[`treeStage${i}`] = `img/tree_${i}_tiny.png`;
        }

        await PIXI.Assets.init({ manifest: assetManifest });
        const loaded = await PIXI.Assets.loadBundle('game-assets');

        for (let i = 0; i < totalTreeStages; i++) this.textures.trees.push(loaded[`treeStage${i}`]);
        this.textures.ground = this._parseGridSpriteSheet(loaded.groundSheet, 128, 128, 4, 4);
        this.textures.weed = this._parseGridSpriteSheet(loaded.weedSheet, 512, 512, 4, 17);
        this.textures.wolf = this._parseAnimalSheet(loaded.wolfSheet, 256, {
            idle: 60, run: 41, eat: 20, jump: 51, sleep: 60, howl: 60
        });
    }

    // ✅ scale 전환 메서드
    async setScale(newScale) {
        // 이미 동일한 스케일이라면 무시
        if (this.currentScale === newScale) return;

        // 캐시 저장소 초기화
        this._rabbitCache = this._rabbitCache || {};
        const scaleDir = `${newScale}`;

        // 🧩 scale < 8 → 토끼 비활성화
        if (newScale < 8) {
            for (const entity of this.entityLayer.children) {
                if (entity.entityType === 'rabbit') entity.visible = false;
            }
            this.currentScale = newScale;
            return;
        }

        // 🧠 새 스케일 로딩 전 참조 해제 (destroy는 하지 않음)
        // 기존 객체를 직접 지우지 않고, 새로운 객체로 교체 (캐시 참조 보존)
        this.textures.rabbit = {};

        // 🧠 캐시에 있으면 즉시 복원
        if (this._rabbitCache[scaleDir]) {
            this.textures.rabbit = this._rabbitCache[scaleDir];
            this.currentScale = newScale;
            console.log(`♻️ Rabbit textures restored from cache for scale ${newScale}`);
        } 
        else {
            // 새 스케일 로딩
            console.log(`⬇️ Loading new rabbit frames for scale ${newScale}...`);
            this.currentScale = newScale;
            await this.loadRabbitFrames();

            // 로딩 완료 후 캐시에 저장
            this._rabbitCache[scaleDir] = this.textures.rabbit;
            console.log(`✅ Cached rabbit frames for scale ${newScale}`);
        }

        // ✅ 스케일 변경 후 rabbit 다시 활성화
        for (const entity of this.entityLayer.children) {
            if (entity.entityType !== 'rabbit') continue;

            entity.visible = true;

            // 🧭 방향 보정
            const dir = entity.currentDir || 'direction_00';
            const idleSet = this.textures.rabbit['idle_1'];
            if (idleSet && idleSet[dir]) {
                entity.textures = idleSet[dir];
                entity.gotoAndPlay(0);
            } else {
                // 폴백 방향
                const validDirs = Object.keys(idleSet || {}).filter(k => idleSet[k]?.length > 0);
                if (validDirs.length > 0) {
                    entity.textures = idleSet[validDirs[0]];
                    entity.gotoAndPlay(0);
                    entity.currentDir = validDirs[0];
                }
            }
        }

        // ✅ 디버그 로그
        console.log(`🐇 setScale(${newScale}) complete. Rabbit assets active.`);
    }



    // ✅ Rabbit 전용 디렉토리 기반 로더
    async loadRabbitFrames() {
        const scaleDir = `${this.currentScale}`;
        this._rabbitCache = this._rabbitCache || {};
        if (this._rabbitCache[scaleDir]) {
            this.textures.rabbit = this._rabbitCache[scaleDir];
            return;
        }

        const basePath = `/img/sprites/rabbit/${scaleDir}`;
        const animations = ['idle_1', 'run_1'];
        const directions = Array.from({ length: 16 }, (_, i) => `direction_${i.toString().padStart(2, '0')}`);

        this.textures.rabbit = {};

        for (const anim of animations) {
            this.textures.rabbit[anim] = {};
            for (const dir of directions) {
                const framePath = `${basePath}/${anim}/${dir}`;
                const frameUrls = [];
                for (let i = 0; i < 100; i++) {
                    const num = i.toString().padStart(4, '0');
                    const url = `${framePath}/webp/frame_${num}.webp`;
                    frameUrls.push(url);
                    
                }

                const validFrames = [];
                for (const url of frameUrls) {
                    try {
                        const img = await this._decodeImage(url);
                        const tex = PIXI.Texture.from(img);
                        validFrames.push(tex);
                    } catch (err) {
                        break;
                    }
                }
                if (validFrames.length > 0)
                this.textures.rabbit[anim][dir] = validFrames;
            }
        }
        console.log(`✅ Rabbit frames loaded for scale ${this.currentScale}`, this.textures.rabbit);
        this._rabbitCache[scaleDir] = this.textures.rabbit;
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
        for (const [name, frameCount] of Object.entries(animationConfig)) {
            animations[name] = this._parseRowSpriteSheet(sheetTexture, frameSize, frameSize, currentY, frameCount);
            currentY += frameSize;
        }
        return animations;
    }

    _parseRowSpriteSheet(texture, frameWidth, frameHeight, yOffset, frameCount) {
        const frames = [];
        for (let i = 0; i < frameCount; i++) {
            const frameRect = new PIXI.Rectangle(i * frameWidth, yOffset, frameWidth, frameHeight);
            frames.push(new PIXI.Texture({ source: texture.source, frame: frameRect }));
        }
        return frames;
    }

    _parseGridSpriteSheet(texture, frameWidth, frameHeight, cols, totalFrames) {
        const frames = [];
        for (let i = 0; i < totalFrames; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const frameRect = new PIXI.Rectangle(col * frameWidth, row * frameHeight, frameWidth, frameHeight);
            frames.push(new PIXI.Texture({ source: texture.source, frame: frameRect }));
        }
        return frames;
    }

    createGround(stageIndex) {
        if (stageIndex < 0 || stageIndex >= this.textures.ground.length) return null;

        const ground = new PIXI.Sprite(this.textures.ground[stageIndex]);
        ground.anchor.set(0.0, 0.0);
        ground.entityType = 'ground';
        this.groundLayer.addChild(ground);
        return ground;
    }

    createWeed(stageIndex) {
        if (stageIndex < 0 || stageIndex >= this.textures.weed.length) return null;

        const weed = new PIXI.Sprite(this.textures.weed[stageIndex]);
        weed.anchor.set(0.5, 1.0);
        weed.entityType = 'weed';
        this.weedLayer.addChild(weed);
        return weed;
    }

    createTree(stageIndex) {
        if (stageIndex < 0 || stageIndex >= this.textures.trees.length) return null;
        
        const tree = new PIXI.Sprite(this.textures.trees[stageIndex]);
        tree.anchor.set(0.5, 1.0);
        tree.entityType = 'tree';
        this.entityLayer.addChild(tree);

        const shadow = new PIXI.Sprite(this.textures.shadow);
        shadow.anchor.set(0.5, 0.5);
        this.shadowLayer.addChild(shadow);
        tree.shadow = shadow;
        tree.shadowWidthRatio = 1.4;
        tree.shadowOffsetY = -250;

        return tree;
    }

    createAnimal(name, initialAnimation) {
        if (name === 'rabbit') {
            // ✅ "idle" → "idle_1" 자동 보정
            const animKey = initialAnimation.endsWith('_1') ? initialAnimation : `${initialAnimation}_1`;
            const dirs = this.textures.rabbit[animKey];
            if (!dirs) {
                console.warn(`Rabbit animation set not found: ${animKey}`);
                return null;
            }

            // ✅ 존재하는 방향만 필터링
            const validDirs = Object.keys(dirs).filter(k => dirs[k] && dirs[k].length > 0);
            if (validDirs.length === 0) {
                console.warn(`No valid direction frames found for ${animKey}`);
                return null;
            }

            const chosenDir = validDirs[Math.floor(Math.random() * validDirs.length)];
            const frames = dirs[chosenDir];

            if (!frames || frames.length === 0) {
                console.warn(`Rabbit frames missing for ${animKey}/${chosenDir}`);
                return null;
            }

            const sprite = new PIXI.AnimatedSprite(frames);
            sprite.currentDir = chosenDir; // ✅ 현재 방향 저장
            sprite.anchor.set(0.5, 1.0);
            sprite.animationSpeed = 0.1;
            sprite.play();

            if (sprite._tick) this.app.ticker.remove(sprite._tick);
            sprite._tick = delta => sprite.update(delta);
            this.app.ticker.add(sprite._tick);

            sprite.on('destroyed', () => {
                if (sprite._tick) this.app.ticker.remove(sprite._tick);
            });
            
            sprite.animations = this.textures.rabbit;
            sprite.entityType = name;
            this.entityLayer.addChild(sprite);

            const shadow = new PIXI.Sprite(this.textures.shadow);
            shadow.anchor.set(0.5, 0.5);
            this.shadowLayer.addChild(shadow);
            sprite.shadow = shadow;
            sprite.shadowOffsetY = -130;
            sprite.shadowWidthRatio = 0.4;
            return sprite;
        }

        // 기존 동물 로직 (wolf 등)
        const animalTextures = this.textures[name];
        if (!animalTextures || !animalTextures[initialAnimation]) return null;
        const animal = new PIXI.AnimatedSprite(animalTextures[initialAnimation]);
        animal.anchor.set(0.5, 1.0);
        animal.animationSpeed = 0.2;
        animal.play();
        animal.animations = animalTextures;
        animal.entityType = name;
        this.entityLayer.addChild(animal);
        const shadow = new PIXI.Sprite(this.textures.shadow);
        shadow.anchor.set(0.5, 0.5);
        this.shadowLayer.addChild(shadow);
        animal.shadow = shadow;
        animal.shadowOffsetY = -20;
        animal.shadowWidthRatio = (name === 'wolf') ? 0.3 : 0.2;
        return animal;
    }
}
