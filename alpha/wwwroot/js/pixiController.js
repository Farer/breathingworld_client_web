'use strict';
import { PixiManager } from './pixiManager.js';

export class PixiController {
    constructor(container, TWEEN, worker) {
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
        };
    }

    static async create(container, TWEEN, worker) {
        const controller = new PixiController(container, TWEEN, worker);
        await controller._init();
        return controller;
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
        return entity;
    }

    returnObject(entity) {
        if (entity.thinkTimer) {
            clearTimeout(entity.thinkTimer);
            entity.thinkTimer = null;
        }
        if (entity.activeTween) {
            this.TWEEN.remove(entity.activeTween);
            entity.activeTween = null;
        }
        if (entity.animations) {
            entity.stop();
        }

        if (entity.entityType && this.pools[entity.entityType]) {
            const pool = this.pools[entity.entityType];
            const MAX_POOL_SIZE = 100;
            if (pool.length < MAX_POOL_SIZE) {
                entity.visible = false;
                if (entity.shadow) {
                    entity.shadow.visible = false;
                }
                pool.push(entity);
            } else {
                entity.destroy({ children: true });
            }
        } else {
            entity.destroy({ children: true });
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
            dom = document.createElement('div'); // ✅ fix
            dom.id = domId;
            dom.style.position = 'absolute';
            dom.style.left = '0px';
            dom.style.top = '0px';
            dom.style.width = '100px';
            dom.style.height = '50px';
            document.body.appendChild(dom);
        }
        let html = '';
        html += 'FPS:' + this.stats.fps;
        html += '<br>Entities:' + this.stats.entityCount;
        dom.innerHTML = html;
    }

    update(ticker) {
        this.stats.fps = ticker.FPS;
        this.stats.entityCount = this.allEntities.size + this.activeWeed.size + this.activeGround.size; // ✅ fix
        this.showStat();

        this.TWEEN.update();

        for (const weed of this.activeWeed.values()) {
            weed.zIndex = weed.y;
        }

        for (const entity of this.allEntities.values()) {
            if (entity.animations) {
                if (entity.lastX === undefined) { entity.lastX = entity.x; entity.lastY = entity.y; }
                const distanceMoved = Math.sqrt(Math.pow(entity.x - entity.lastX, 2) + Math.pow(entity.y - entity.lastY, 2));
                if (distanceMoved > 0.1) {
                    const currentSpeed = distanceMoved / ticker.deltaTime;
                    entity.animationSpeed = 0.1 + currentSpeed * 0.2;
                }
                entity.lastX = entity.x;
                entity.lastY = entity.y;
            }
            entity.zIndex = entity.y;

            if (entity.shadow) {
                const baseScale = entity.baseScale || 1.0;
                const scaledOffsetY = (entity.shadowOffsetY || 0) * baseScale;
                entity.shadow.x = entity.x;
                entity.shadow.y = entity.y + scaledOffsetY;
                entity.shadow.zIndex = entity.y;
                const shadowScale = baseScale * (entity.shadowWidthRatio || 1.0);
                entity.shadow.scale.set(shadowScale);
            }
        }
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
    
    moveTo(character, target, duration) {
        // 1️⃣ 이동 방향 계산
        const dirIndex = this.getDirectionIndex(character.x, character.y, target.x, target.y);
        const dirKey = `direction_${dirIndex}`;

        // 2️⃣ 애니메이션 전환
        if (character.entityType === 'rabbit') {
            const animSet = character.animations['run_1'];
            if (animSet && animSet[dirKey]) {
                character.textures = animSet[dirKey];
                character.play();
                character.currentDir = dirKey;
            }
        } else if (character.animations && character.animations.run) {
            character.textures = character.animations.run;
            character.play();
        }

        // 3️⃣ 트윈 이동
        if (character.activeTween) this.TWEEN.remove(character.activeTween);
        const tween = new this.TWEEN.Tween(character.position)
            .to(target, duration * 1000)
            .easing(this.TWEEN.Easing.Quadratic.InOut)
            .onComplete(() => {
                // ✅ 이동 완료 후 idle_1로 전환
                if (character.entityType === 'rabbit') {
                    const idleSet = character.animations['idle_1'];
                    if (idleSet && idleSet[character.currentDir]) {
                        character.textures = idleSet[character.currentDir];
                        character.play();
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
        const screen = this.pixiManager.app.screen;
        const camera = this.pixiManager.app.stage;
        const target = { x: (Math.random() - 0.5) * screen.width, y: (Math.random() - 0.5) * screen.height };
        const duration = 1.5;

        new this.TWEEN.Tween(camera.position)
            .to(target, duration * 1000)
            .easing(this.TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                console.log("Map move complete. Populating new scene.");
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
