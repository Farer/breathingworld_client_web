'use strict';
export class PixiManager {
    constructor(targetElement, worker) {
        if (!targetElement) throw new Error("invalid targetElement");

        // Scale 관리
        this.currentScale = 1;
        this.isLoading = false;
        this.frameSkip = 1;

        // ✅ 현재 로딩 중인 작업을 추적하는 AbortController
        this._currentLoadController = null;
        this._currentLoadingScale = null;

        // 🧩 Safari-safe patch: Safari 감지 및 worker 제한
        this._isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (this._isSafari) {
            console.warn("🧩 Safari detected — worker decoding disabled for safety.");
            worker = null;
        }

        this.worker = worker;
        this.isReady = false;
        this.app = null;

        this._onLoadingAnimalFrames = false;

        this.textures = {
            ground: [], weed: [], shadow: null, trees: [],
            rabbit: {}, wolf: {}, eagle: {}
        };

        // ✅ 추가: validDirs 캐시
        this._validDirections = new Map();

        // 애니메이션 설정
        this.animalConfig = {
            rabbit: {
                lifeStages: ['adult'],
                animations: ['idle_1', 'run_1', 'eat_1', 'sleep_3'],
                frameCount: {
                    idle_1: 35,
                    run_1: 14,
                    eat_1: 24,
                    sleep_3: 12
                }
            }
            // 추후 다른 동물 추가 가능
        };

        this._init(targetElement);
    }

    // ✅ 현재 로딩 작업 취소
    cancelCurrentLoading() {
        if (this._currentLoadController) {
            console.log(`🛑 Cancelling loading for scale ${this._currentLoadingScale}`);
            this._currentLoadController.abort();
            this._currentLoadController = null;
            this._currentLoadingScale = null;
        }
    }

    resetTextureCache() {
        this.textures.rabbit = {};
    }

    async _init(targetElement) {
        this.app = new PIXI.Application();

        if (!window.location.hostname.includes('breathingworld.com')) {
            window.__PIXI_DEVTOOLS__ = {
                app: this.app
                // 또는: stage: app.stage, renderer: app.renderer
            };
        }

        // 🧩 Safari-safe patch: iOS GPU 발열 완화용 옵션 추가
        await this.app.init({
            backgroundAlpha: 0,
            resizeTo: window,
            powerPreference: 'low-power'
        });

        const gl = this.app.renderer.gl;
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

        targetElement.appendChild(this.app.view);

        this.groundLayer = new PIXI.Container();
        this.shadowLayer = new PIXI.Container(); this.shadowLayer.sortableChildren = true;
        this.weedLayer = new PIXI.Container(); this.weedLayer.sortableChildren = true;
        this.entityLayer = new PIXI.Container(); this.entityLayer.sortableChildren = true;
        // this.app.stage.addChild(this.groundLayer, this.weedLayer, this.shadowLayer, this.entityLayer);

        await this.loadAssets();
        this.isReady = true;
    }

    showLoader() {
        Variables.Doms.get('texture-loader').style.opacity = 1;
    }

    hideLoader() {
        Variables.Doms.get('texture-loader').style.opacity = 0;
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

            // const totalTreeStages = 12;
            // for (let i = 0; i < totalTreeStages; i++)
            //     manifest.bundles[0].assets[`treeStage${i}`] = `img/tree_${i}_tiny.png`;

        await PIXI.Assets.init({ manifest });
        const loaded = await PIXI.Assets.loadBundle('game-assets');

        // for (let i = 0; i < totalTreeStages; i++)
        //     this.textures.trees.push(loaded[`treeStage${i}`]);

        this.textures.ground = this._parseGridSpriteSheet(loaded.groundSheet, 128, 128, 4, 4);
        this.textures.weed = this._parseGridSpriteSheet(loaded.weedSheet, 512, 512, 4, 17);
        this.textures.wolf = this._parseAnimalSheet(loaded.wolfSheet, 256, {
            idle: 60, run: 41, howl: 60
        });
    }

    // ✅ 종(species)별 로드
    async loadAnimalFrames(species, lifeStage, scale) {
        // 1️⃣ 이전 로딩 작업 취소
        if (this._currentLoadingScale !== null && this._currentLoadingScale !== scale) {
            console.log(`🛑 New scale ${scale} requested, cancelling previous load ${this._currentLoadingScale}`);
            this.cancelCurrentLoading();
        }

        console.log(`📥 Loading new textures: ${species}/${lifeStage}/${scale}`);

        // 2️⃣ 새로운 AbortController 생성
        this._currentLoadController = new AbortController();
        this._currentLoadingScale = scale;

        try {
            // 새로운 텍스처 로드
            let loadedTextures = {};
            
            if (species === 'rabbit') {
                loadedTextures = await this._loadDirectionalFrames(
                    species, 
                    lifeStage, 
                    this.animalConfig.rabbit.animations,
                    scale,
                    this._currentLoadController.signal  // ✅ signal 전달
                );
                this.hideLoader();
            } else if (species === 'eagle') {
                loadedTextures = await this._loadDirectionalFrames(
                    species, 
                    lifeStage, 
                    ['idle', 'fly', 'attack'], 
                    scale,
                    this._currentLoadController.signal  // ✅ signal 전달
                );
            } else if (species === 'wolf') {
                // wolf는 sprite sheet 기반이므로 별도 처리
                return;
            }

            // 3️⃣ 취소되지 않았다면 캐시에 저장
            if (!this._currentLoadController.signal.aborted) {
                // 현재 활성 텍스처로 설정
                this.textures[species][lifeStage] = loadedTextures;
                this._currentTextureScale = scale;

                console.log(`✅ ${species} - ${lifeStage} frames cached for scale ${scale}`);
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`✅ Loading cancelled for scale ${scale}`);
            } else {
                console.error(`❌ Loading failed:`, error);
                throw error;
            }
        } finally {
            // 4️⃣ 완료되면 controller 초기화
            if (this._currentLoadingScale === scale) {
                this._currentLoadController = null;
                this._currentLoadingScale = null;
            }
            // 최종 메모리 상태 출력
            this.logMemoryUsage(`(After loading ${species}/${lifeStage})`);
        }
    }

    // 기존 _loadDirectionalFrames를 수정하지 않고 새 함수 생성
    async _loadDirectionalFrames(species, lifeStage, animations, scale, signal) {
        this.showLoader();
        const scaleDir = `${scale}`;
        const basePath = `/img/ktx2/${species}/${lifeStage}/${scaleDir}`;
        const dirs = Array.from({ length: 16 }, (_, i) => 
            `direction_${i.toString().padStart(2, '0')}`
        );
        
        // 새로운 독립적인 객체 생성
        const result = {};
        const MAX_FRAMES = this._isSafari ? 30 : 100;

        for (const animationKind of animations) {
            // ✅ 취소 체크
            if (signal?.aborted) {
                throw new DOMException('Loading cancelled', 'AbortError');
            }

            result[animationKind] = {};

            let actualFrameCount;
            if (species === 'rabbit') {
                if (animationKind === 'idle_1') actualFrameCount = this.animalConfig.rabbit.frameCount.idle_1;
                else if (animationKind === 'run_1') actualFrameCount = this.animalConfig.rabbit.frameCount.run_1;
                else if (animationKind === 'eat_1') actualFrameCount = this.animalConfig.rabbit.frameCount.eat_1;
                else if (animationKind === 'sleep_3') actualFrameCount = this.animalConfig.rabbit.frameCount.sleep_3;
                else actualFrameCount = 1;
            } else {
                actualFrameCount = MAX_FRAMES;
            }

            this.frameSkip = this.calculateFrameSkipByDeviceCapability();

            const dirPromises = dirs.map(async dir => {
                // ✅ 취소 체크
                if (signal?.aborted) {
                    throw new DOMException('Loading cancelled', 'AbortError');
                }

                const path = `${basePath}/${animationKind}/${dir}`;
                const frames = [];

                for (let i = 0; i < actualFrameCount; i+=this.frameSkip) {
                    // ✅ 프레임마다 취소 체크
                    if (signal?.aborted) {
                        throw new DOMException('Loading cancelled', 'AbortError');
                    }
                    const num = i.toString().padStart(4, '0');
                    const url = `${path}/frame_${num}.ktx2`;

                    const tex = await this._decodeImage(url, signal);
                    if (!tex) {
                        console.warn(`⚠️ Missing frame ${i} at ${path}`);
                        break;
                    }

                    frames.push(tex);
                }

                if (animationKind === 'idle_1' && dir === 'direction_00') {
                    console.log(`${scale} : ${frames.length} frames loaded (expected size: ${frames.length * 16})`);
                }

                return { dir, frames };
            });

            try {
                const results = await Promise.all(dirPromises);
                // ✅ 취소 체크
                if (signal?.aborted) {
                    throw new DOMException('Loading cancelled', 'AbortError');
                }
                results.forEach(({ dir, frames }) => {
                    if (frames.length > 0) {
                        result[animationKind][dir] = frames;
                    }
                });

                // validDirections 캐싱 (scale 포함)
                const cacheKey = `${species}-${lifeStage}-${animationKind}`;
                const validDirs = Object.keys(result[animationKind])
                    .filter(k => result[animationKind][k]?.length);
                this._validDirections.set(cacheKey, validDirs);
            } catch (error) {
                // Promise.all 중 하나라도 실패하면 전체 취소
                if (error.name === 'AbortError') {
                    throw error;  // 취소 에러는 상위로 전파
                }
                console.error(`Error loading ${animationKind}:`, error);
                throw error;
            }
        }

        return result;
    }

    async _decodeImage(url, signal = null) {
        // ✅ 취소 체크
        if (signal?.aborted) {
            throw new DOMException('Loading cancelled', 'AbortError');
        }

        try {
            // KTX2 처리
            if (url.endsWith('.ktx2')) {
                try {
                    const res = await PIXI.Assets.load(url);
                    if (!res) {
                        console.warn('KTX2 load returned null:', url);
                        return null;
                    }

                    const base = res.baseTexture || res;
                    const tex = new PIXI.Texture(base);
                    return tex;
                } catch (err) {
                    console.warn(`KTX2 outer load failed: ${url}`, err);
                    return null;
                }
            }

            // Worker 없는 경우
            if (!this.worker || this._isSafari) {
                const res = await fetch(url);
                if (!res.ok) throw new Error('Failed to fetch: ' + url);
                const blob = await res.blob();
                const bitmap = await createImageBitmap(blob);
                const tex = PIXI.Texture.from(bitmap);
                return tex;
            }

            // ✅ Worker 처리 (수정됨)
            return new Promise((resolve, reject) => {
                const id = Math.random().toString(36).slice(2);
                let timeoutId;
                let settled = false; // ✅ Promise settled 여부 추적
                
                const cleanup = () => {
                    clearTimeout(timeoutId);
                    this.worker.removeEventListener('message', onMsg);
                };
                
                const onMsg = (e) => {
                    if (e.data && e.data.id === id) {
                        cleanup();
                        
                        // ✅ 이미 settled된 Promise면 아무것도 하지 않음
                        if (settled) {
                            console.warn(`⏰ Late response ignored for: ${url}`);
                            // 늦게 온 bitmap 정리
                            if (e.data.bitmap) {
                                e.data.bitmap.close?.(); // ImageBitmap 메모리 해제
                            }
                            return;
                        }
                        
                        settled = true;
                        
                        if (e.data.error) {
                            reject(e.data.error);
                        } else {
                            try {
                                const bitmap = e.data.bitmap;
                                const tex = PIXI.Texture.from(bitmap);
                                resolve(tex);
                            } catch (err) {
                                reject(err);
                            }
                        }
                    }
                };
                
                this.worker.addEventListener('message', onMsg);
                this.worker.postMessage({ type: 'decode', url, id });
                
                timeoutId = setTimeout(() => {
                    cleanup();
                    
                    // ✅ settled 플래그 설정
                    if (!settled) {
                        settled = true;
                        reject(new Error(`Worker timeout: ${url}`));
                    }
                }, 7500);
            });
            
        } catch (err) {
            console.warn('Image decode failed for', url, err);
            return null;
        }
    }

    async applyScale(newScale) {
        // ✅ 현재 로딩 중인 작업 취소
        this.currentScale = newScale;
        this.cancelCurrentLoading();
        this.resetTextureCache();
        PIXI.Assets.reset();
        if(newScale <= 4) {
            this.hideLoader();
            return;
        }
        this.isLoading = true;
        const AllLifeStages = Variables.lifeStages.rabbit;
        const AllAnimals = ['rabbit'];
        // 캐시에 있으면 즉시 전환, 없으면 백그라운드 로드
        for (const species of AllAnimals) {
            for(const lifeStage of AllLifeStages) {
                try {
                    await this.loadAnimalFrames(species, lifeStage, newScale);
                    console.log(`✅ 완료: ${species} - ${lifeStage} (${newScale})`);
                }
                catch(error) {
                    continue;
                }
                this.isLoading = false;
            }
        }
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
    createAnimal(species, lifeStage, animationKind) {
        const t = this.textures[species][lifeStage];
        if (!t) return null;
        if (species === 'rabbit') return this._createRabbit(lifeStage, animationKind);
        if (species === 'wolf') return this._createWolf(lifeStage, animationKind);
        return this._createGeneric(species, lifeStage, animationKind);
    }

    _createRabbit(lifeStage, animationKey) {
        const animationKind = animationKey.endsWith('_1') ? animationKey : `${animationKey}_1`;
        const dirs = this.textures.rabbit[lifeStage][animationKind];

        // ✅ 캐시에서 가져오기 (계산 없음)
        const cacheKey = `rabbit-${lifeStage}-${animationKind}`;
        let validDirs = this._validDirections.get(cacheKey);
        // ✅ 캐시 미스 시에만 계산 (fallback)
        if (!validDirs) {
            validDirs = Object.keys(dirs).filter(k => dirs[k]?.length);
            this._validDirections.set(cacheKey, validDirs);
        }
        const dir = validDirs[Math.floor(Math.random() * validDirs.length)];
        const sprite = new PIXI.AnimatedSprite(dirs[dir]);
        sprite.entityType = 'rabbit';
        sprite.currentDir = dir;
        sprite.anchor.set(0.5, 1);
        sprite.animationSpeed = animationKind.startsWith("idle_") ? 0.12 : 0.55;
        sprite.play();
        // sprite._tick = d => sprite.update(d);

        // this.app.ticker.add(sprite._tick);
        
        // ✅ 더 안전한 정리 로직
        const cleanup = () => {
            if (sprite._tick) {
                this.app.ticker.remove(sprite._tick);
            }
        };
        // ✅ 풀 반환 시에도 정리할 수 있도록 참조 저장
        sprite._cleanup = cleanup;

        this._addShadow(sprite, -130, 0.4);
        this.entityLayer.addChild(sprite);
        sprite.animations = this.textures.rabbit[lifeStage];
        return sprite;
    }

    _createWolf(lifeStage, anim) {
        const frames = this.textures.wolf[anim][lifeStage];
        const s = new PIXI.AnimatedSprite(frames);
        s.entityType = 'wolf';
        s.anchor.set(0.5, 1);
        s.animationSpeed = 0.25;
        s.play();
        this._addShadow(s, -20, 0.3);
        this.entityLayer.addChild(s);
        s.animations = this.textures.wolf[lifeStage];
        return s;
    }

    _createGeneric(species, lifeStage, animationKind) {
        const dirs = this.textures[species][lifeStage][animationKind];
        // ✅ 동일한 패턴 적용
        const cacheKey = `${species}-${lifeStage}-${animationKind}`;
        let valid = this._validDirections.get(cacheKey);
        if (!valid) {
            valid = Object.keys(dirs).filter(k => dirs[k]?.length);
            this._validDirections.set(cacheKey, valid);
        }
        const dir = valid[Math.floor(Math.random() * valid.length)];
        const s = new PIXI.AnimatedSprite(dirs[dir]);
        s.entityType = species;
        s.anchor.set(0.5, 1);
        s.animationSpeed = 0.4;
        s.play();
        this._addShadow(s, -100, 0.25);
        this.entityLayer.addChild(s);
        s.animations = this.textures[species][lifeStage];
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

    // pixiManager.js - cleanup() 강화 버전
    cleanup() {
        console.log('🧹 Cleaning up PixiManager...');
        
        // ✅ Layers 정리
        const layers = [this.groundLayer, this.weedLayer, this.shadowLayer, this.entityLayer];
        for (const layer of layers) {
            if (layer) {
                layer.removeChildren();
                layer.destroy({ children: true, texture: true, baseTexture: true });
            }
        }

        // ✅ PIXI Assets 캐시 제거
        PIXI.Assets.reset();

        // ✅ BaseTexture 캐시 제거
        PIXI.utils.clearTextureCache();
        
        // PIXI Application 정리
        if (this.app) {
            this.app.destroy(true, { 
                children: true, 
                texture: true, 
                baseTexture: true 
            });
            this.app = null;
        }
        
        // Worker 참조 제거
        this.worker = null;
        
        // ✅ 상태 플래그
        this.isReady = false;

        // ✅ validDirections 캐시 정리
        if (this._validDirections) {
            this._validDirections.clear();
            this._validDirections = null;
        }
        
        console.log('✅ PixiManager cleanup complete');
    }

    // ✅ 기기 사양 감지 및 프레임 스킵 결정
    calculateFrameSkipByDeviceCapability() {
        // 모바일 기기 감지
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        
        // 메모리 추정 (간접적)
        const deviceMemory = navigator.deviceMemory || 4; // GB 단위, 기본값 4GB
        
        console.log(`   Device info: Mobile=${isMobile}, Memory≈${deviceMemory}GB, MaxTexture=${this.maxTextureSize}`);
        
        // 동적 프레임 스킵 계산 사용
        const dynamicSkip = this.calculateDynamicFrameSkip(this.currentScale);
        
        return dynamicSkip;
    }

    // ✅ 디바이스 메모리 예산 계산
    getDeviceMemoryBudget() {
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        const deviceMemory = navigator.deviceMemory || 4; // GB 단위
        
        if (isMobile) {
            // 모바일: 전체 메모리의 10%, 최대 100MB
            return Math.min(100, deviceMemory * 1024 * 0.1);
        } else {
            // 데스크톱: 전체 메모리의 20%, 최대 500MB  
            return Math.min(500, deviceMemory * 1024 * 0.2);
        }
    }

    // ✅ Scale에 따른 텍스처 하나의 크기 (MB)
    getTextureSizeByScale(scale) {
        const resolutions = {
            8: 32, 16: 64, 32: 128, 64: 256, 128: 512
        };
        const resolution = resolutions[scale] || 32;
        const bytesPerPixel = 4; // RGBA
        const bytesPerTexture = resolution * resolution * bytesPerPixel;
        return bytesPerTexture / (1024 * 1024); // MB로 변환
    }

    // ✅ 전체 프레임 수 계산
    getTotalFrameCount(species = 'rabbit') {
        const config = this.animalConfig[species];
        if (!config) return 0;
        
        let totalFrames = 0;
        for (const animation of config.animations) {
            totalFrames += config.frameCount[animation] || 0;
        }
        return totalFrames * 16; // 16방향
    }

    // ✅ 동적 프레임 스킵 계산 (메인 함수)
    calculateDynamicFrameSkip(scale) {
        const memoryBudget = this.getDeviceMemoryBudget();
        const textureSizeMB = this.getTextureSizeByScale(scale);
        const totalFrames = this.getTotalFrameCount();
        
        // 전체 메모리 사용량 계산
        const totalMemoryMB = textureSizeMB * totalFrames;
        
        // 기본 스킵 계산 (메모리 예산에 맞춰서)
        let baseSkip = Math.ceil(totalMemoryMB / memoryBudget);
        
        // Scale별 최소 스킵 설정
        const minSkipByScale = {
            8: 1,
            16: 1,
            32: 1,
            64: 2,
            128: 3
        };
        
        // 디바이스별 조정
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
            baseSkip = Math.max(baseSkip, Math.ceil(scale / 16)); // 모바일은 더 적극적으로 스킵
        }
        
        // 최소/최대 제한 적용
        const minSkip = minSkipByScale[scale] || 1;
        const maxSkip = 8; // 최대 8프레임마다
        
        const finalSkip = Math.min(maxSkip, Math.max(minSkip, baseSkip));
        
        // 로그 출력
        console.log(`📊 Dynamic Frame Skip Calculation:`);
        console.log(`   Scale: ${scale} (${this.getTextureSizeByScale(scale).toFixed(2)}MB per texture)`);
        console.log(`   Memory Budget: ${memoryBudget.toFixed(0)}MB`);
        console.log(`   Total Frames: ${totalFrames}`);
        console.log(`   Total Memory (no skip): ${totalMemoryMB.toFixed(2)}MB`);
        console.log(`   Calculated Skip: ${finalSkip}`);
        console.log(`   Expected Memory: ${(totalMemoryMB / finalSkip).toFixed(2)}MB`);
        
        return finalSkip;
    }

    getTextureSizeMB(width, height, format = 'RGBA') {
        const bytesPerPixel = {
            'RGBA': 4,
            'RGB': 3,
            'LUMINANCE_ALPHA': 2,
            'LUMINANCE': 1,
            'ALPHA': 1
        };
        const bytes = width * height * (bytesPerPixel[format] || 4);
        const mb = bytes / (1024 * 1024);
        return mb;
    }

    // ✅ 애니메이션별 차별화된 스킵 계산
    calculateAnimationSpecificSkip(animation, baseSkip) {
        // 애니메이션 우선순위 설정
        const priorities = {
            idle_1: 3.0,  // 중요 - 스킵 최소화
            run_1: 1.0,   // 빠른 동작 - 약간 스킵 가능
            eat_1: 1.0,   // 중간 중요도
            sleep_3: 3.0  // 느린 동작 - 많이 스킵 가능
        };
        
        const multiplier = priorities[animation] || 1.0;
        return Math.max(1, Math.round(baseSkip * multiplier));
    }

    // ✅ 런타임 메모리 압박 감지 및 조정
    adjustSkipOnMemoryPressure() {
        if (!performance.memory) return this.frameSkip;
        
        const used = performance.memory.usedJSHeapSize;
        const limit = performance.memory.jsHeapSizeLimit;
        const usage = used / limit;
        
        if (usage > 0.8) {
            // 80% 이상 사용 시 스킵 2배 증가
            const newSkip = Math.min(8, this.frameSkip * 2);
            console.warn(`⚠️ Memory pressure detected (${(usage * 100).toFixed(0)}%): Increasing skip to ${newSkip}`);
            return newSkip;
        } else if (usage > 0.6) {
            // 60% 이상 사용 시 스킵 1.5배 증가
            const newSkip = Math.min(8, Math.ceil(this.frameSkip * 1.5));
            console.log(`📊 Memory usage high (${(usage * 100).toFixed(0)}%): Adjusting skip to ${newSkip}`);
            return newSkip;
        }
        
        return this.frameSkip;
    }

    // ✅ 메모리 사용량 예측
    predictMemoryUsage(scale, frameSkip = 1) {
        const textureSizeMB = this.getTextureSizeByScale(scale);
        const totalFrames = this.getTotalFrameCount();
        const loadedFrames = Math.ceil(totalFrames / frameSkip);
        return textureSizeMB * loadedFrames;
    }

    // ✅ Scale 변경 가능 여부 체크
    canChangeToScale(newScale) {
        const predictedMemory = this.predictMemoryUsage(newScale, 1);
        const memoryBudget = this.getDeviceMemoryBudget();
        
        if (predictedMemory > memoryBudget) {
            const requiredSkip = Math.ceil(predictedMemory / memoryBudget);
            console.log(`⚠️ Scale ${newScale} requires ${predictedMemory.toFixed(0)}MB`);
            console.log(`   Suggested frame skip: ${requiredSkip}`);
            return { possible: true, suggestedSkip: requiredSkip };
        }
        
        return { possible: true, suggestedSkip: 1 };
    }
    
    // ✅ 메모리 모니터 DOM 생성 및 업데이트
    createMemoryMonitor() {
        // 기존 모니터가 있다면 제거
        const existing = document.getElementById('webgl-memory-monitor');
        if (existing) {
            existing.remove();
        }
        
        // 모니터 컨테이너 생성
        const monitor = document.createElement('div');
        monitor.id = 'webgl-memory-monitor';
        monitor.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #00ff00;
            z-index: 10000;
            min-width: 280px;
            backdrop-filter: blur(5px);
        `;
        
        // 제목
        const title = document.createElement('div');
        title.style.cssText = `
            font-weight: bold;
            margin-bottom: 8px;
            padding-bottom: 5px;
            border-bottom: 1px solid #00ff00;
            color: #ffffff;
        `;
        title.textContent = '📊 WebGL Memory Monitor';
        monitor.appendChild(title);
        
        // 정보 라인들
        const infoLines = [
            { id: 'scale-info', label: 'Scale' },
            { id: 'texture-max-size', label: 'Max Texture Size' },
            { id: 'texture-count', label: 'Textures' },
            { id: 'gpu-memory', label: 'GPU Memory (Est.)' },
            { id: 'js-heap', label: 'JS Heap' },
            { id: 'loading-status', label: 'Status' }
        ];
        
        infoLines.forEach(line => {
            const div = document.createElement('div');
            div.style.cssText = 'margin: 3px 0;';
            div.innerHTML = `<span style="color: #888;">${line.label}:</span> <span id="${line.id}" style="color: #00ff00;">-</span>`;
            monitor.appendChild(div);
        });
        
        // 닫기 버튼
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: none;
            border: none;
            color: #ff0000;
            cursor: pointer;
            font-size: 16px;
            padding: 0;
            width: 20px;
            height: 20px;
        `;
        closeBtn.onclick = () => this.stopMemoryMonitor();
        monitor.appendChild(closeBtn);
        
        // DOM에 추가
        document.body.appendChild(monitor);
        
        // 업데이트 루프 시작
        this.startMemoryMonitorUpdate();
        
        console.log('✅ Memory monitor created');
    }
    
    // ✅ 메모리 모니터 업데이트 시작
    startMemoryMonitorUpdate() {
        // 이전 인터벌이 있다면 제거
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
        }
        
        // 업데이트 함수
        const updateMonitor = () => {
            const monitor = document.getElementById('webgl-memory-monitor');
            if (!monitor) {
                this.stopMemoryMonitor();
                return;
            }
            
            const memInfo = this.getMemoryInfo();
            const status = this.getLoadingStatus();
            
            // Scale 정보 업데이트
            const scaleEl = document.getElementById('scale-info');
            if (scaleEl) {
                scaleEl.textContent = `${status.currentScale} (Skip: ${status.frameSkip})`;
                scaleEl.style.color = status.currentScale >= 8 ? '#00ff00' : '#ff8800';
            }

            const maxTextureSizeMB = this.getTextureSizeMB(this.maxTextureSize, this.maxTextureSize);
            // 최대 텍스처 크기 업데이트
            const maxTexEl = document.getElementById('texture-max-size');
            if (maxTexEl) {
                maxTexEl.textContent = `${this.maxTextureSize} px (${maxTextureSizeMB.toFixed(2)} MB)`;
                maxTexEl.style.color = this.maxTextureSize >= 4096 ? '#00ff00' : '#ff8800';
            }
            
            // 텍스처 개수 업데이트
            const textureEl = document.getElementById('texture-count');
            if (textureEl) {
                textureEl.textContent = memInfo.textureCount.toLocaleString();
                textureEl.style.color = memInfo.textureCount > 1000 ? '#ffff00' : '#00ff00';
            }
            
            // GPU 메모리 업데이트
            const gpuEl = document.getElementById('gpu-memory');
            if (gpuEl) {
                gpuEl.textContent = memInfo.estimatedTextureMemory;
                const memValue = parseFloat(memInfo.estimatedTextureMemory);
                gpuEl.style.color = memValue > 500 ? '#ff0000' : (memValue > 100 ? '#ffff00' : '#00ff00');
            }
            
            // JS Heap 업데이트
            const heapEl = document.getElementById('js-heap');
            if (heapEl) {
                if (memInfo.jsHeapUsed) {
                    heapEl.textContent = `${memInfo.jsHeapUsed} / ${memInfo.jsHeapTotal}`;
                    const usage = parseFloat(memInfo.jsHeapUsed) / parseFloat(memInfo.jsHeapTotal);
                    heapEl.style.color = usage > 0.8 ? '#ff0000' : (usage > 0.5 ? '#ffff00' : '#00ff00');
                } else {
                    heapEl.textContent = 'N/A (Open DevTools)';
                    heapEl.style.color = '#888';
                }
            }
            
            // 로딩 상태 업데이트
            const statusEl = document.getElementById('loading-status');
            if (statusEl) {
                if (status.isLoading) {
                    statusEl.textContent = '⏳ Loading...';
                    statusEl.style.color = '#ffff00';
                    // 로딩 중일 때 애니메이션
                    statusEl.style.animation = 'pulse 1s infinite';
                } else {
                    statusEl.textContent = '✅ Ready';
                    statusEl.style.color = '#00ff00';
                    statusEl.style.animation = 'none';
                }
            }
        };
        
        // CSS 애니메이션 추가
        if (!document.getElementById('memory-monitor-styles')) {
            const style = document.createElement('style');
            style.id = 'memory-monitor-styles';
            style.textContent = `
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // 초기 업데이트
        updateMonitor();
        
        // 1초마다 업데이트
        this.memoryMonitorInterval = setInterval(updateMonitor, 1000);
    }
    
    // ✅ 메모리 모니터 중지
    stopMemoryMonitor() {
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
            this.memoryMonitorInterval = null;
        }
        
        const monitor = document.getElementById('webgl-memory-monitor');
        if (monitor) {
            monitor.remove();
        }
        
        const styles = document.getElementById('memory-monitor-styles');
        if (styles) {
            styles.remove();
        }
        
        console.log('✅ Memory monitor stopped');
    }
    
    // ✅ 메모리 사용량 측정 (Chrome용)
    getMemoryInfo() {
        const info = {
            textureCount: this.countLoadedTextures(),
            estimatedSize: 0
        };
        
        // Chrome의 performance.memory API 사용 (개발자 도구 열려있을 때만 정확)
        if (performance.memory) {
            info.jsHeapUsed = (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB';
            info.jsHeapTotal = (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB';
            info.jsHeapLimit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB';
        }
        
        // 텍스처 메모리 추정 (각 텍스처당 크기 계산)
        let totalTextureMemory = 0;
        const scaleToSize = {
            8: 32 * 32 * 4,      // 32x32 RGBA
            16: 64 * 64 * 4,     // 64x64 RGBA  
            32: 128 * 128 * 4,   // 128x128 RGBA
            64: 256 * 256 * 4,   // 256x256 RGBA
            128: 512 * 512 * 4   // 512x512 RGBA
        };
        
        const bytesPerTexture = scaleToSize[this.currentScale] || 0;
        totalTextureMemory = info.textureCount * bytesPerTexture;
        
        info.estimatedTextureMemory = (totalTextureMemory / 1048576).toFixed(2) + ' MB';
        info.currentScale = this.currentScale;
        
        return info;
    }
    
    // ✅ 메모리 로깅 헬퍼
    logMemoryUsage(context = '') {
        const memInfo = this.getMemoryInfo();
        console.log(`📊 Memory Usage ${context}:`);
        console.log(`   Textures: ${memInfo.textureCount}`);
        console.log(`   Estimated GPU Memory: ${memInfo.estimatedTextureMemory}`);
        if (memInfo.jsHeapUsed) {
            console.log(`   JS Heap: ${memInfo.jsHeapUsed} / ${memInfo.jsHeapTotal}`);
        }
        return memInfo;
    }
    
    // ✅ 로딩 상태 조회
    getLoadingStatus() {
        return {
            currentScale: this.currentScale,
            isLoading: this.isLoading,
            frameSkip: this.frameSkip,
            textureCount: this.countLoadedTextures()
        };
    }
    
    // ✅ 로드된 텍스처 개수 계산
    countLoadedTextures() {
        let count = 0;
        
        for (const species in this.textures) {
            if (species === 'shadow' || species === 'ground' || species === 'weed' || species === 'trees') {
                continue;
            }
            
            for (const lifeStage in this.textures[species]) {
                for (const animation in this.textures[species][lifeStage]) {
                    for (const direction in this.textures[species][lifeStage][animation]) {
                        const frames = this.textures[species][lifeStage][animation][direction];
                        if (Array.isArray(frames)) {
                            count += frames.length;
                        }
                    }
                }
            }
        }
        return count;
    }
}
