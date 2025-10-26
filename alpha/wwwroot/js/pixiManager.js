'use strict';
import { WeightedLRUCache } from './weightedLRUCache.js'; // ✅ 추가
export class PixiManager {
    constructor(targetElement, worker) {
        if (!targetElement) throw new Error("invalid targetElement");

        // 🧩 Safari-safe patch: Safari 감지 및 worker 제한
        this._isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (this._isSafari) {
            console.warn("🧩 Safari detected — worker decoding disabled for safety.");
            worker = null;
        }

        this.worker = worker;
        this.isReady = false;
        this.app = null;

        this._reservedToLoadAnimalFrames = [];
        this._onLoadingAnimalFrames = false;

        // ✅ species별 캐시
        this._animalCache = {};

        this.textures = {
            ground: [], weed: [], shadow: null, trees: [],
            rabbit: {}, wolf: {}, eagle: {}
        };

        // ✅ 추가: validDirs 캐시
        this._validDirections = new Map();

        this.sharedInterpFilters = {}; // species별 공유 필터

        // ✅ Map 대신 LRUCache 사용
        this._texCache = new WeightedLRUCache(4000);
        // 📊 캐시 히트율 추적 (선택사항)
        this._cacheHits = 0;
        this._cacheMisses = 0;
        // ✅ 주기적으로 가중치 감소 (선택사항)
        this._decayInterval = setInterval(() => {
            this._texCache.decayWeights(0.95);
        }, 180000);

        this._init(targetElement);
    }

    async _init(targetElement) {
        this.app = new PIXI.Application();

        if (!window.location.hostname.includes('breathingworld.com')) {
            window.__PIXI_DEVTOOLS__ = {
                app: this.app
                // 또는: stage: app.stage, renderer: app.renderer
            };
        }

        // ⭐ WebGPU 지원 체크
        const isWebGPUSupported = await this.checkWebGPUSupport();
        console.log(`WebGPU supported: ${isWebGPUSupported}`);

        // 🧩 Safari-safe patch: iOS GPU 발열 완화용 옵션 추가
        await this.app.init({
            // ⭐⭐ WebGPU 우선 사용 (실패시 자동으로 WebGL 폴백)
            preference: isWebGPUSupported ? 'webgpu' : 'webgl',
            backgroundAlpha: 0,
            resizeTo: window,
            // ⭐ WebGPU 모드에서는 high-performance 사용
            powerPreference: isWebGPUSupported ? 'high-performance' : 'low-power',
            // ⭐ 추가 옵션들
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        // ⭐ 렌더러 타입 확인
        console.log(`✅ Renderer type: ${this.app.renderer.type}`);
        if (this.app.renderer.type === 2) {
            console.log('🎉 WebGPU 렌더러 활성화! 대용량 텍스처 지원');
            this.isWebGPU = true;
            this.applyWebGPUOptimizations();
        } else {
            console.log('⚠️ WebGL 렌더러 사용 중');
            this.isWebGPU = false;
        }

        targetElement.appendChild(this.app.view);

        this.groundLayer = new PIXI.Container();
        this.shadowLayer = new PIXI.Container(); this.shadowLayer.sortableChildren = true;
        this.weedLayer = new PIXI.Container(); this.weedLayer.sortableChildren = true;
        this.entityLayer = new PIXI.Container(); this.entityLayer.sortableChildren = true;
        this.app.stage.addChild(this.groundLayer, this.weedLayer, this.shadowLayer, this.entityLayer);

        await this.loadAssets();
        this.isReady = true;
    }

    // ⭐ WebGPU 지원 체크 함수 추가 (새 메서드)
    async checkWebGPUSupport() {
        // navigator.gpu 체크
        if (!navigator.gpu) {
            console.log('WebGPU not available in this browser');
            return false;
        }

        try {
            // GPU 어댑터 요청
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                console.log('No GPU adapter found');
                return false;
            }

            // 디바이스 요청 및 제한 확인
            const device = await adapter.requestDevice();
            const limits = device.limits;

            console.log(`GPU Max texture size: ${limits.maxTextureDimension2D}x${limits.maxTextureDimension2D}`);
            console.log(`GPU Max buffer size: ${limits.maxBufferSize / (1024 * 1024)}MB`);

            // 최소 4096x4096 텍스처 지원 필요
            return limits.maxTextureDimension2D >= 4096;
        } catch (error) {
            console.error('WebGPU check failed:', error);
            return false;
        }
    }

    // ⭐ WebGPU 최적화 설정 (새 메서드)
    applyWebGPUOptimizations() {
        // PixiJS v8.14.0 API에 맞게 수정
        const renderer = this.app.renderer;

        // WebGPU 렌더러 확인
        if (renderer.type !== 2) {
            console.warn('Not a WebGPU renderer, skipping optimizations');
            return;
        }

        // 1. 텍스처 가비지 컬렉션 설정
        // v8에서는 textureGC가 다르게 구현됨
        if (renderer.textureGC) {
            renderer.textureGC.maxIdle = 3600 * 1000; // 1시간 (밀리초)
            renderer.textureGC.checkCountMax = 600;
            // v8에서 GC_MODES가 없으므로 직접 설정
            renderer.textureGC.mode = 2; // 2 = MANUAL mode
            console.log('✅ Texture GC configured for WebGPU');
        }

        // 2. 배치 사이즈 증가 (WebGPU는 더 많은 텍스처 처리 가능)
        if (renderer.batcher) {
            renderer.batcher.maxTextures = 32; // 기본값 16
            console.log('✅ Batcher max textures: 32');
        }

        // 3. WebGPU 전용 설정
        if (renderer.gpu) {
            // GPU 디바이스 정보
            const device = renderer.gpu.device;
            if (device) {
                console.log('✅ WebGPU Device:', device);

                // 디바이스 한계값 확인
                const limits = device.limits;
                console.log(`  - Max texture size: ${limits.maxTextureDimension2D}`);
                console.log(`  - Max buffer size: ${limits.maxBufferSize / (1024 * 1024)}MB`);
                console.log(`  - Max bind groups: ${limits.maxBindGroups}`);
            }
        }

        // 4. 메모리 풀 크기 조정 (WebGPU는 더 많은 메모리 사용 가능)
        if (renderer.buffer) {
            renderer.buffer.poolSize = 100; // 기본값 50
        }

        console.log('✅ WebGPU optimizations applied successfully!');
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
    async loadAnimalFrames(species, lifeStage, scale) {
        // 캐시 구조 초기화
        this._animalCache[species] = this._animalCache[species] || {};
        if (!this._animalCache[species][lifeStage]) {
            this._animalCache[species][lifeStage] = {};
        }

        // 이미 캐시된 경우
        if (this._animalCache[species][lifeStage][scale]) {
            this.textures[species][lifeStage] = this._animalCache[species][lifeStage][scale];
            this._currentTextureScale = scale;
            return;
        }

        // 새로운 텍스처 로드
        let loadedTextures = {};

        if (species === 'rabbit') {
            loadedTextures = await this._loadDirectionalFrames(
                species,
                lifeStage,
                ['idle_1', 'idle_2', 'walk_1', 'run_1', 'sleep_3'],
                scale
            );
        } else if (species === 'eagle') {
            loadedTextures = await this._loadDirectionalFrames(
                species,
                lifeStage,
                ['idle', 'fly', 'attack'],
                scale
            );
        } else if (species === 'wolf') {
            // wolf는 sprite sheet 기반이므로 별도 처리
            return;
        }

        // 캐시에 저장 (독립적인 객체)
        this._animalCache[species][lifeStage][scale] = loadedTextures;

        // 현재 활성 텍스처로 설정
        this.textures[species][lifeStage] = loadedTextures;
        this._currentTextureScale = scale;

        console.log(`✅ ${species} - ${lifeStage} frames cached for scale ${scale}`);
    }

    // 기존 _loadDirectionalFrames를 수정하지 않고 새 함수 생성
    async _loadDirectionalFrames(species, lifeStage, animations, scale) {
        const scaleDir = `${scale}`;
        const basePath = `/img/ktx2/${species}/${lifeStage}/${scaleDir}`;
        const dirs = Array.from({ length: 16 }, (_, i) =>
            `direction_${i.toString().padStart(2, '0')}`
        );

        // 새로운 독립적인 객체 생성
        const result = {};
        const MAX_FRAMES = this._isSafari ? 30 : 100;

        for (const animationKind of animations) {
            result[animationKind] = {};

            let actualFrameCount;
            if (species === 'rabbit') {
                if (animationKind === 'idle_1') actualFrameCount = 35;
                else if (animationKind === 'idle_2') actualFrameCount = 22;
                else if (animationKind === 'walk_1') actualFrameCount = 21;
                else if (animationKind === 'run_1') actualFrameCount = 14;
                else if (animationKind === 'sleep_3') actualFrameCount = 12;
                else actualFrameCount = 1;
            } else {
                actualFrameCount = MAX_FRAMES;
            }

            const dirPromises = dirs.map(async dir => {
                const path = `${basePath}/${animationKind}/${dir}`;
                const frames = [];

                for (let i = 0; i < actualFrameCount; i++) {
                    const num = i.toString().padStart(4, '0');
                    const url = `${path}/frame_${num}.ktx2`;

                    const tex = await this._decodeImage(url);
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

            const results = await Promise.all(dirPromises);
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
        }

        return result;
    }

    // 📊 캐시 성능 모니터링
    getCacheStats() {
        // 캐시된 결과 반환 (너무 자주 계산하지 않기)
        const now = performance.now();
        if (this._lastStatsTime && now - this._lastStatsTime < 1000) {
            return this._cachedStats;
        }

        const total = this._cacheHits + this._cacheMisses;
        const hitRate = total > 0
            ? (this._cacheHits / total * 100).toFixed(1)
            : 0;

        this._cachedStats = {
            size: this._texCache.cache.size,
            maxSize: this._texCache.maxSize,
            usage: (this._texCache.cache.size / this._texCache.maxSize * 100).toFixed(1) + '%',
            hits: this._cacheHits,
            misses: this._cacheMisses,
            hitRate: hitRate + '%'
        };

        this._lastStatsTime = now;
        return this._cachedStats;
    }

    async _decodeImage(url) {
        try {
            // 캐시 체크
            if (this._texCache.has(url)) {
                this._cacheHits++;
                return this._texCache.get(url);
            }
            this._cacheMisses++;

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
                    this._texCache.set(url, tex);
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
                this._texCache.set(url, tex);
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
                                this._texCache.set(url, tex);
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

    async applyTextureImmediately(newScale) {
        // 현재 활성 텍스처 확인
        const currentTexture = this.textures.rabbit['adult']?.['idle_1']?.['direction_00']?.[0];
        if (currentTexture && currentTexture.width) {
            console.log(`Current active texture: width ${currentTexture.width}`);
        }

        const AllLifeStages = Variables.lifeStages.rabbit;
        const AllAnimals = ['rabbit'];
        // 캐시에 있으면 즉시 전환, 없으면 백그라운드 로드
        for (const species of AllAnimals) {
            for (const lifeStage of AllLifeStages) {
                try {
                    const cached = this._animalCache[species][lifeStage]?.[`${newScale}`];
                    if (cached) {
                        this.textures[species][lifeStage] = cached;
                    } else {
                        // 비동기로 로드하되, 기존 텍스처는 유지
                        await this.reserveLoadAnimalFrames(species, 'adult', newScale);
                    }
                }
                catch (error) {
                    continue;
                }
            }
        }
    }

    // 🐾 로딩 예약 (큐에 추가)
    async reserveLoadAnimalFrames(species, lifeStage, scale) {
        const key = `${species}-${lifeStage}-${scale}`;

        // 중복 예약 방지
        if (this._reservedToLoadAnimalFrames.includes(key)) {
            console.log(`⚠️ 이미 예약된 항목: ${key}`);
            return;
        }

        this._reservedToLoadAnimalFrames.push(key);
        console.log(`📝 예약됨: ${key}`);

        // 로딩 프로세스 시작 트리거
        await this._triggerToLoadAnimalFrames();
    }

    //🌀 예약된 항목들을 순차적으로 처리
    async _triggerToLoadAnimalFrames() {
        // 이미 로딩 중이면 리턴
        if (this._onLoadingAnimalFrames) {
            return;
        }

        // 큐가 비어있으면 종료
        if (this._reservedToLoadAnimalFrames.length === 0) {
            console.log('✅ 로드 대기열이 비어 있음.');
            return;
        }

        // 로딩 시작
        this._onLoadingAnimalFrames = true;
        this.showLoader();

        // 큐가 빌 때까지 계속 처리
        while (this._reservedToLoadAnimalFrames.length > 0) {
            const target = this._reservedToLoadAnimalFrames.shift();
            const [species, lifeStage, scale] = target.split("-");

            console.log(`🚀 시작: ${species} - ${lifeStage} (${scale})`);

            try {
                await this.loadAnimalFrames(species, lifeStage, scale);
                console.log(`✅ 완료: ${species} - ${lifeStage} (${scale})`);
            } catch (err) {
                console.warn(`❌ 실패: ${species} - ${lifeStage} (${scale})`, err);
            }
        }

        // 모든 처리 완료
        console.log('🏁 모든 예약된 로드 완료');
        this.checkTexture();

        this.hideLoader();
        this._onLoadingAnimalFrames = false;

        if (window.pixiController) {
            window.pixiController.populateScene();
        }
    }

    checkTexture() {
        try { console.log('8 : ' + pixiController.pixiManager._animalCache.rabbit.adult['8'].idle_1.direction_00[0].width); } catch (e) { }
        try { console.log('16 : ' + pixiController.pixiManager._animalCache.rabbit.adult['16'].idle_1.direction_00[0].width); } catch (e) { }
        try { console.log('32 : ' + pixiController.pixiManager._animalCache.rabbit.adult['32'].idle_1.direction_00[0].width); } catch (e) { }
        try { console.log('64 : ' + pixiController.pixiManager._animalCache.rabbit.adult['64'].idle_1.direction_00[0].width); } catch (e) { }
        try { console.log('128 : ' + pixiController.pixiManager._animalCache.rabbit.adult['128'].idle_1.direction_00[0].width); } catch (e) { }
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

        // if (window.FrameInterpFilter && animationKind.startsWith("idle_")) {
        //     if (!this.sharedInterpFilters.rabbit)
        //         this.sharedInterpFilters.rabbit = new FrameInterpFilter();
        //     const f = this.sharedInterpFilters.rabbit;
        //     sprite.filters = [f];
        //     this._applyInterpTick(sprite, f);
        // } else {
        //     sprite._tick = d => sprite.update(d);
        // }
        sprite._tick = d => sprite.update(d);

        this.app.ticker.add(sprite._tick);

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

        // Interval 정리
        if (this._decayInterval) {
            clearInterval(this._decayInterval);
            this._decayInterval = null;
        }

        // 텍스처 캐시 정리
        if (this._texCache) {
            this._texCache.clear();
            this._texCache = null;
        }

        // 동물 캐시 정리
        this._animalCache = {};

        // ✅ Shared filters 정리
        if (this.sharedInterpFilters) {
            for (const filter of Object.values(this.sharedInterpFilters)) {
                if (filter && filter.destroy) {
                    filter.destroy();
                }
            }
            this.sharedInterpFilters = {};
        }

        // ✅ Layers 정리
        const layers = [this.groundLayer, this.weedLayer, this.shadowLayer, this.entityLayer];
        for (const layer of layers) {
            if (layer) {
                layer.removeChildren();
                layer.destroy({ children: true });
            }
        }

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
}
