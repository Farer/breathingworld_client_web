'use strict';
import { PixiManager } from './pixiManager.js';

export class PixiController {
    constructor(container, TWEEN, worker) {

        // 🧩 Safari-safe patch: Safari 감지
        this._isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (this._isSafari) {
            console.warn("🧩 Safari detected — enabling safety limits (lower frame load, FPS cap).");
        }

        // 성능 모니터링
        this._fpsHistory = [];
        this._performanceWarningShown = false;

        this.pixiManager = new PixiManager(container, worker);
        this.TWEEN = TWEEN;
        this.worker = worker;
        
        this.activeGround = new Map();
        this.activeWeed = new Map();
        this.allEntities = new Map();

        this.pools = {
            ground: [],
            weed: [],
            tree: [],
            rabbit: [],
            wolf: [],
        };

        this.stats = {
            fps: 0,
            entityCount: 0,
            textureMemory: PIXI.Assets.cache.size,
            poolEfficiency: 'N/A'
        };

        // 디바이스 성능 기반 동적 조정
        this._lastFrameTime = 0;
        this._deviceTier = this._detectDeviceTier();
        this._targetFPS = this._deviceTier === 'low' ? 30 : 45;
        this.MAX_VISIBLE_ENTITIES = this._deviceTier === 'low' ? 50 : 100;
    }

    _calculatePoolEfficiency() {
        const total = Object.values(this.pools)
            .reduce((sum, pool) => sum + pool.length, 0);
        const active = this.allEntities.size + this.activeWeed.size + this.activeGround.size;
        return total > 0 ? (active / (active + total) * 100).toFixed(1) + '%' : 'N/A';
    }

    static async create(container, TWEEN, worker) {
        const controller = new PixiController(container, TWEEN, worker);
        await controller._init();
        return controller;
    }

    _detectDeviceTier() {
        const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
        const cores = navigator.hardwareConcurrency || 2;
        const memory = navigator.deviceMemory || 2;
        
        if (!isMobile && cores >= 8 && memory >= 8) return 'high';
        if (cores >= 4 && memory >= 4) return 'medium';
        return 'low';
    }
    
    async _init() {
        await new Promise(resolve => {
            const checkReady = () => {
                if (this.pixiManager.app && this.pixiManager.isReady) resolve();
                else setTimeout(checkReady, 100);
            };
            checkReady();
        });

        const initialSceneData = [];
        
        // for (let i = 0; i < 50; i++) {
        //     initialSceneData.push({
        //         category: 'environment',
        //         species: 'ground',
        //         stage: Math.floor(Math.random() * 4),
        //         x: Math.random() * this.pixiManager.app.screen.width,
        //         y: Math.random() * this.pixiManager.app.screen.height,
        //         baseScale: 1.0
        //     });
        // }
        // for (let i = 0; i < 50; i++) {
        //     initialSceneData.push({
        //         category: 'plant',
        //         species: 'weed',
        //         stage: Math.floor(Math.random() * 17),
        //         x: Math.random() * this.pixiManager.app.screen.width,
        //         y: Math.random() * this.pixiManager.app.screen.height,
        //         baseScale: 0.1 
        //     });
        // }
        // initialSceneData.push({
        //     category: 'plant',
        //     species: 'tree',
        //     stage: 8,
        //     x: this.pixiManager.app.screen.width * 0.7,
        //     y: this.pixiManager.app.screen.height * 0.5,
        //     baseScale: 0.1 + Math.random() * 0.4 
        // });
        for (let i = 0; i < 10; i++) {
            initialSceneData.push({
                category: 'animal',
                species: 'rabbit',
                x: Math.random() * this.pixiManager.app.screen.width,
                y: Math.random() * this.pixiManager.app.screen.height,
                baseScale: 0.4 + Math.random() * 0.4 
            });
        }
        // initialSceneData.push({
        //     category: 'animal',
        //     species: 'wolf',
        //     x: this.pixiManager.app.screen.width * 0.2,
        //     y: this.pixiManager.app.screen.height * 0.8,
        //     baseScale: 1.0
        // });

        this.populateScene(initialSceneData);

        if (this.updateHandler) { this.pixiManager.app.ticker.remove(this.updateHandler); }
        this.updateHandler = (ticker) => this.update(ticker);
        this.pixiManager.app.ticker.add(this.updateHandler);
    }

    borrowObject(species, stage) {
        const pool = this.pools[species];
        let entity = null;
        if (pool.length > 0) {
            entity = pool.pop();
            entity.visible = true;
            if (entity.shadow) entity.shadow.visible = true;
            // ✅ 토끼라면 틱 재등록
            if (entity.entityType === 'rabbit') {
                if (!entity._tick) {
                    entity._tick = delta => entity.update(delta);
                }
                this.pixiManager.app.ticker.add(entity._tick);
            }
            if (species === 'tree' || species === 'weed') {
                const textureKey = (species === 'tree') ? 'trees' : 'weed';
                if (entity.texture !== this.pixiManager.textures[textureKey][stage]) {
                    entity.texture = this.pixiManager.textures[textureKey][stage];
                }
            }
        } else {
            switch (species) {
                case 'ground': entity = this.pixiManager.createGround(stage); break;
                case 'weed': entity = this.pixiManager.createWeed(stage); break;
                case 'tree': entity = this.pixiManager.createTree(stage); break;
                case 'rabbit': case 'wolf': entity = this.pixiManager.createAnimal(species, 'idle'); break;
            }
        }
        // ⚠️ AnimatedSprite가 아닐 수도 있으니 방어적으로
        if (entity && entity.animations) entity.animationSpeed = 0.1;
        if (entity) entity.zIndex = 0;
        return entity;
    }

    returnObject(entity) {
        // 1️⃣ 타이머 정리
        if (entity.thinkTimer) {
            clearTimeout(entity.thinkTimer);
            entity.thinkTimer = null;
        }
        
        // 2️⃣ 트윈 정리
        if (entity.activeTween) {
            entity.activeTween.stop();
            this.TWEEN.remove(entity.activeTween);
            entity.activeTween = null;
        }
        
        // 3️⃣ 애니메이션 정리
        if (entity.animations) {
            entity.stop();
        }

        // 4️⃣ 개별 틱 제거
        if (entity._tick && this.pixiManager && this.pixiManager.app) {
            this.pixiManager.app.ticker.remove(entity._tick);
        }

        // 5️⃣ 이벤트 리스너 명시적 제거
        if (entity.onFrameChange) {
            entity.onFrameChange = null;
        }

        // 6️⃣ 풀에 반환 또는 파괴
        if (entity.entityType && this.pools[entity.entityType]) {
            const pool = this.pools[entity.entityType];
            const MAX_POOL_SIZE = this._deviceTier === 'low' ? 30 : 
                                this._deviceTier === 'medium' ? 60 : 100;
            
            if (pool.length < MAX_POOL_SIZE) {
                // ✅ 풀에 반환 (재사용)
                entity.visible = false;
                if (entity.shadow) {
                    entity.shadow.visible = false;
                }
                
                // 캐시 초기화
                entity._cachedShadowOffsetY = undefined;
                entity._lastGlobalScale = undefined;
                entity._lastZIndex = undefined;
                
                // 참조 정리 (하지만 객체는 파괴하지 않음)
                entity.animations = null;
                entity.activeTween = null;
                entity._tick = null;
                
                pool.push(entity);
            } else {
                // ✅ 풀이 가득 참 - 완전히 파괴
                if (entity.shadow) {
                    entity.shadow.destroy({ texture: false });
                    entity.shadow = null;
                }
                
                entity.animations = null;
                entity.activeTween = null;
                entity._tick = null;
                
                entity.destroy({ children: true, texture: false, baseTexture: false });
            }
        } else {
            // ✅ 풀이 없는 타입 - 완전히 파괴
            if (entity.shadow) {
                entity.shadow.destroy({ texture: false });
                entity.shadow = null;
            }
            
            entity.animations = null;
            entity.activeTween = null;
            entity._tick = null;
            
            entity.destroy({ children: true, texture: false, baseTexture: false });
        }
    }

    clearScene() {
        this.TWEEN.removeAll();
        for (const entity of this.activeGround.values()) {
            this.returnObject(entity);
        }
        for (const entity of this.activeWeed.values()) {
            this.returnObject(entity);
        }
        for (const entity of this.allEntities.values()) {
            this.returnObject(entity);
        }
        this.allEntities.clear();
        this.activeWeed.clear();
        this.activeGround.clear();
    }

    addEntity(data) {
        try {
            const entity = this.borrowObject(data.species, data.stage);
            if (entity) {
                entity.category = data.category;
                entity.id = entity.id || `${data.species}_${Math.random()}`;
                entity.x = data.x;
                entity.y = data.y;
                entity.baseScale = data.baseScale || 1.0;
                entity.scale.set(entity.baseScale);

                if (data.species === 'ground') {
                    this.activeGround.set(entity.id, entity);
                }
                else if (data.species === 'weed') {
                    this.activeWeed.set(entity.id, entity);
                } else {
                    this.allEntities.set(entity.id, entity);
                }
            }
        }
        catch(e) {
            console.log(e)
        }
    }

    populateScene(sceneData) {
        this.clearScene();
        sceneData.forEach(data => {
            this.addEntity(data);
        });
        for (const entity of this.allEntities.values()) {
            if (entity.animations) {
                this.thinkAndAct(entity);
            }
        }
    }

    showStat() {
        const domId = 'webGlStatDom';
        let dom = document.getElementById(domId);
        if(dom == null) {
            dom = document.createElement('div');
            dom.id = domId;
            dom.style.position = 'absolute';
            dom.style.left = '0px';
            dom.style.top = '0px';
            dom.style.width = '220px';
            dom.style.height = '100px';
            dom.style.fontSize = '11px';
            dom.style.background = 'rgba(0,0,0,0.7)';
            dom.style.color = '#0f0';
            dom.style.padding = '5px';
            dom.style.fontFamily = 'monospace';
            document.body.appendChild(dom);
        }
        
        const poolStats = Object.entries(this.pools)
            .map(([type, pool]) => `${type[0].toUpperCase()}:${pool.length}`)
            .join(' ');
        
        // ✅ 실제 렌더링되는 스프라이트 수 계산
        const visibleSprites = Array.from(this.allEntities.values()).filter(e => e.visible).length;
        
        let html = '';
        html += `FPS: ${this.stats.fps} / ${this._targetFPS}`;
        html += `<br>Entities: ${this.stats.entityCount} (${visibleSprites} visible)`;
        html += `<br>Active: G:${this.activeGround.size} W:${this.activeWeed.size} E:${this.allEntities.size}`;
        html += `<br>Pool: ${poolStats}`;
        html += `<br>Pool Efficiency: ${this.stats.poolEfficiency}`;
        html += `<br>Textures: ${PIXI.Assets.cache.size}`;
        html += `<br>Device: ${this._deviceTier.toUpperCase()}`;
        dom.innerHTML = html;
    }

    async update(ticker) {
        this.TWEEN.update();

        const now = performance.now();
        const elapsed = now - this._lastFrameTime;
        const frameInterval = 1000 / this._targetFPS;

        if (elapsed < frameInterval) { return; }
        this._lastFrameTime = now - (elapsed % frameInterval);

        const currentFps = Math.round(1000 / ticker.deltaMS);
        this.stats.fps = currentFps;
        
        this._fpsHistory.push(currentFps);
        if (this._fpsHistory.length > 60) this._fpsHistory.shift();
        
        if (this._fpsHistory.length === 60 && !this._performanceWarningShown) {
            const avgFps = this._fpsHistory.reduce((a, b) => a + b, 0) / 60;
            if (avgFps < this._targetFPS * 0.8) {
                console.warn(`⚠️ Low FPS detected: ${avgFps.toFixed(1)} (target: ${this._targetFPS})`);
                this._performanceWarningShown = true;
            }
        }

        this.stats.entityCount = this.allEntities.size + this.activeWeed.size + this.activeGround.size;
        this.showStat();

        const globalScale = window.currentMapScale || 128;
        if (this.pixiManager.currentScale !== globalScale) {
            await this.pixiManager.setScale(globalScale);
        }

        // ✅ 플래그 초기화
        let needsSort = false;

        for (const entity of this.allEntities.values()) {
            if (entity.animations) {
                if (entity.lastX === undefined) { 
                    entity.lastX = entity.x; 
                    entity.lastY = entity.y; 
                }
                const distanceMoved = Math.sqrt(
                    Math.pow(entity.x - entity.lastX, 2) + 
                    Math.pow(entity.y - entity.lastY, 2)
                );
                if (distanceMoved > 0.1) {
                    const currentSpeed = distanceMoved / ticker.deltaTime;
                    entity.animationSpeed = Math.min(0.45, 0.12 + currentSpeed * 0.1);
                }
                entity.lastX = entity.x;
                entity.lastY = entity.y;
            }
            
            // ✅ y 값이 실제로 변경되었을 때만 업데이트
            if (Math.abs(entity.y - (entity._lastZIndex || 0)) > 1) {
                entity.zIndex = entity.y;
                entity._lastZIndex = entity.y;
                needsSort = true; // ✅ 플래그 설정
            }

            if (entity.shadow) {
                if (entity._lastGlobalScale !== this.pixiManager.currentScale || entity._cachedShadowOffsetY === undefined) {
                    const baseScale = entity.baseScale || 1.0;
                    const globalScale = this.pixiManager.currentScale / 128;
                    entity._cachedShadowOffsetY = (entity.shadowOffsetY || 0) * baseScale * globalScale;
                    const shadowScale = baseScale * globalScale * (entity.shadowWidthRatio || 1.0);
                    entity.shadow.scale.set(shadowScale);
                    entity._lastGlobalScale = this.pixiManager.currentScale;
                }
                
                entity.shadow.x = entity.x;
                entity.shadow.y = entity.y + entity._cachedShadowOffsetY;
                entity.shadow.zIndex = entity.y;
            }
        }

        // ✅ 루프 밖에서 한 번만 정렬
        if (needsSort) {
            this.pixiManager.entityLayer.sortChildren();
            this.pixiManager.shadowLayer.sortChildren();
        }

        this.stats.poolEfficiency = this._calculatePoolEfficiency();
        this.stats.textureMemory = PIXI.Assets.cache.size;
    }

    getDirectionIndex(fromX, fromY, toX, toY) {
        // atan2(y, x) → 라디안 각도 (-π~π)
        const dx = toX - fromX;
        const dy = toY - fromY;
        let angle = Math.atan2(dy, dx); // 라디안
        angle = (angle + Math.PI * 2) % (Math.PI * 2); // 0~2π로 보정
        const degree = angle * 180 / Math.PI; // 도(degree)
        // direction_00 = 북쪽 = -90°, 즉 270°
        const adjusted = (degree + 90) % 360;
        const index = Math.round(adjusted / 22.5) % 16;
        return index.toString().padStart(2, '0');
    }

    _pickDir(animSet, dirKey) {
        // 1️⃣ 정확히 일치하는 방향이 있으면 그대로 반환
        if (animSet[dirKey]?.length) return dirKey;

        // 2️⃣ 근사 방향 탐색 (양쪽으로 1~7스텝 이내)
        const idx = parseInt(dirKey.slice(-2), 10);
        for (let step = 1; step < 8; step++) {
            const cw = `direction_${String((idx + step) % 16).padStart(2, '0')}`;
            const ccw = `direction_${String((idx - step + 16) % 16).padStart(2, '0')}`;
            if (animSet[cw]?.length) return cw;
            if (animSet[ccw]?.length) return ccw;
        }

        // 3️⃣ 폴백: 남아 있는 유효 키 중 아무거나 선택
        const validKeys = Object.keys(animSet).filter(k => animSet[k]?.length);
        if (validKeys.length > 0) return validKeys[0];

        // 4️⃣ 최후의 방어선: 경고 1초에 한 번만 출력 + 현재 방향 유지
        if (!this._warnedMissingDir) {
            console.warn(`⚠️ _pickDir(): No valid direction found for ${dirKey}, keeping current texture.`);
            this._warnedMissingDir = true;
            setTimeout(() => this._warnedMissingDir = false, 1000);
        }
        return dirKey;
    }
    
    moveTo(character, target, duration) {
        // 1️⃣ 이동 방향 계산
        const dirIndex = this.getDirectionIndex(character.x, character.y, target.x, target.y);
        const dirKey = `direction_${dirIndex}`;

        // 2️⃣ 애니메이션 전환
        if (character.entityType === 'rabbit') {
            const animSet = character.animations['run_1'];
            if (animSet) {
                const pickedDir = this._pickDir(animSet, dirKey);
                if (pickedDir) {
                    character.textures = animSet[pickedDir];
                    character.gotoAndPlay(0);
                    character.currentDir = pickedDir;
                } else {
                    console.warn(`🐇 No valid run_1 direction found for ${dirKey}`);
                }
            }
        } else if (character.animations && character.animations.run) {
            character.textures = character.animations.run;
            character.play();
        }

        // 3️⃣ 트윈 이동
        if (character.activeTween) this.TWEEN.remove(character.activeTween);
        if (character.thinkTimer) clearTimeout(character.thinkTimer);

        const tween = new this.TWEEN.Tween(character.position)
            .to(target, duration * 1000)
            .easing(this.TWEEN.Easing.Quadratic.InOut)
            .onComplete(() => {
                // ✅ 이동 완료 후 idle_1로 전환
                if (character.entityType === 'rabbit') {
                    const idleSet = character.animations['idle_1'];
                    if (idleSet) {
                        const pickedDir = this._pickDir(idleSet, character.currentDir);
                        if (pickedDir) {
                            character.textures = idleSet[pickedDir];
                            character.gotoAndPlay(0);
                            character.currentDir = pickedDir;
                        } else {
                            console.warn(`🐇 No valid idle_1 direction found for ${character.currentDir}`);
                        }
                    }
                } else if (character.animations && character.animations.idle) {
                    character.textures = character.animations.idle;
                    character.play();
                }

                character.activeTween = null;
                character.thinkTimer = setTimeout(() => {
                    if (character.visible) this.thinkAndAct(character);
                }, 1000 + Math.random() * 3000);
            })
            .start();

        character.activeTween = tween;
    }

    
    thinkAndAct(character) {
        const screen = this.pixiManager.app.screen;
        const target = { x: Math.random() * screen.width, y: Math.random() * screen.height };
        const distance = Math.sqrt(Math.pow(target.x - character.x, 2) + Math.pow(target.y - character.y, 2));
        const duration = distance / 150;
        this.moveTo(character, target, duration);
    }

    moveMap() {
        console.log("Simulating map drag...");
        if (this._isMovingMap) {
            console.log('already moving...')
            return;
        }
        this._isMovingMap = true;

        const screen = this.pixiManager.app.screen;
        const camera = this.pixiManager.app.stage;
        const target = { x: (Math.random() - 0.5) * screen.width, y: (Math.random() - 0.5) * screen.height };
        const duration = 1.5;

        new this.TWEEN.Tween(camera.position)
            .to(target, duration * 1000)
            .easing(this.TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                console.log("Map move complete. Populating new scene.");
                this._isMovingMap = false;
                const newSceneData = [];

                for (let i = 0; i < 20; i++) {
                    const x = (Math.random() * screen.width) - target.x;
                    const y = (Math.random() * screen.height) - target.y;
                    const rand = Math.random();
                    if (rand < 0.1) newSceneData.push({
                        category: 'plant',
                        species: 'tree',
                        stage: Math.floor(Math.random() * 12),
                        x: x,
                        y: y,
                        baseScale: 0.1 + Math.random() * 0.4
                    });
                    else if (rand < 0.6) newSceneData.push({
                        category: 'animal',
                        species: 'rabbit',
                        x: x,
                        y: y,
                        baseScale: 0.4 + Math.random() * 0.4
                    });
                    else newSceneData.push({
                        category: 'animal',
                        species: 'wolf',
                        x: x,
                        y: y,
                        baseScale: 1.0
                    });
                }

                for (let i = 0; i < 50; i++) {
                    const x = (Math.random() * screen.width) - target.x;
                    const y = (Math.random() * screen.height) - target.y;
                    newSceneData.push({
                        category: 'plant',
                        species: 'weed',
                        stage: Math.floor(Math.random() * 17),
                        x: x,
                        y: y,
                        baseScale: 0.1
                    });
                }

                for (let i = 0; i < 50; i++) {
                    const x = (Math.random() * screen.width) - target.x;
                    const y = (Math.random() * screen.height) - target.y;
                    newSceneData.push({
                        category: 'environment',
                        species: 'ground',
                        stage: Math.floor(Math.random() * 4),
                        x: x,
                        y: y,
                        baseScale: 1.0
                    });
                }

                this.populateScene(newSceneData);
            })
            .start();
    }
}
