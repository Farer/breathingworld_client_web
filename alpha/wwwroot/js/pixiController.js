'use strict';
import { PixiManager } from './pixiManager.js';
export class PixiController {
    constructor(container, tweenLibs) {
        this.pixiManager = new PixiManager(container);
        this.Tween = tweenLibs.Tween;
        this.Easing = tweenLibs.Easing;
        this.updateTweens = tweenLibs.updateTweens;

        this.allEntities = [];
        this._init();
    }

    async _init() {
        await new Promise(resolve => {
            const checkReady = () => {
                if (this.pixiManager.app && this.pixiManager.textures.trees.length > 0) resolve();
                else setTimeout(checkReady, 100);
            };
            checkReady();
        });

        const bigTree = this.pixiManager.createTree(8);
        bigTree.x = this.pixiManager.app.screen.width * 0.7;
        bigTree.y = this.pixiManager.app.screen.height * 0.5;
        this.allEntities.push(bigTree);

        const grassCount = 50;
        for (let i = 0; i < grassCount; i++) {
            const grass = this.pixiManager.createGrass(Math.floor(Math.random() * 17));
            grass.x = Math.random() * this.pixiManager.app.screen.width;
            grass.y = Math.random() * this.pixiManager.app.screen.height;
            grass.scale.set(0.1);
        }

        for (let i = 0; i < 10; i++) {
            const rabbit = this.pixiManager.createAnimal('rabbit', 'idle');
            rabbit.x = Math.random() * this.pixiManager.app.screen.width;
            rabbit.y = Math.random() * this.pixiManager.app.screen.height;
            rabbit.baseScale = 0.4 + Math.random() * 0.4;
            rabbit.scale.set(rabbit.baseScale); // 초기 스케일 설정
            this.allEntities.push(rabbit);
        }
        const wolf = this.pixiManager.createAnimal('wolf', 'idle');
        wolf.x = this.pixiManager.app.screen.width * 0.2;
        wolf.y = this.pixiManager.app.screen.height * 0.8;
        this.allEntities.push(wolf);

        // --- AI 시작 ---
        // allEntities 배열에서 'animations' 속성을 가진 객체(동물)만 골라 AI를 시작시킵니다.
        this.allEntities.forEach(entity => {
            if (entity.animations) {
                this.thinkAndAct(entity);
            }
        });

        // --- Ticker 설정 ---
        this.pixiManager.app.ticker.add((ticker) => {
            this.updateTweens();

            for (const entity of this.allEntities) {
                if (entity.animations) {
                    if (entity.lastX === undefined) {
                        entity.lastX = entity.x;
                        entity.lastY = entity.y;
                        continue;
                    }
                    const dx = entity.x - entity.lastX;
                    const dy = entity.y - entity.lastY;
                    const distanceMoved = Math.sqrt(dx * dx + dy * dy);

                    if (distanceMoved > 0.1) {
                        const currentSpeed = distanceMoved / ticker.deltaTime;
                        const baseAnimationSpeed = 0.1;
                        const speedMultiplier = 0.2;
                        entity.animationSpeed = baseAnimationSpeed + currentSpeed * speedMultiplier;
                    }
                    entity.lastX = entity.x;
                    entity.lastY = entity.y;
                }
            }

            for (const child of this.pixiManager.grassLayer.children) { child.zIndex = child.y; }
            for (const child of this.pixiManager.entityLayer.children) {
                child.zIndex = child.y;
                if (child.shadow) {
                    const baseScale = child.baseScale || 1.0;
                    const scaledOffsetY = (child.shadowOffsetY || 0) * baseScale;
                    child.shadow.x = child.x;
                    child.shadow.y = child.y + scaledOffsetY;
                    child.shadow.zIndex = child.y;
                    const shadowScale = baseScale * (child.shadowWidthRatio || 0.8);
                    child.shadow.scale.set(shadowScale);
                    const objectWidth = child.texture.width * Math.abs(child.scale.x);
                    child.shadow.width = objectWidth * (child.shadowWidthRatio || 0.8);
                    child.shadow.height = objectWidth * 0.2;
                }
            }
        });
    }

    moveTo(character, target, duration) {
        const direction = (target.x > character.x) ? 1 : -1;
        const baseScale = character.baseScale || 1.0;
        character.scale.y = baseScale;
        character.scale.x = direction * -1 * baseScale;

        character.textures = character.animations.run;
        character.play();

        new this.Tween(character.position)
            .to(target, duration * 1000)
            .easing(this.Easing.Quadratic.InOut)
            .onComplete(() => {
                character.textures = character.animations.idle;
                character.play();
                // setTimeout 콜백 안에서도 this 컨텍스트를 유지하기 위해 화살표 함수 사용
                setTimeout(() => this.thinkAndAct(character), 1000 + Math.random() * 3000);
            })
            .start();
    }
    
    thinkAndAct(character) {
        const screen = this.pixiManager.app.screen;
        const target = { x: Math.random() * screen.width, y: Math.random() * screen.height };
        const distance = Math.sqrt(Math.pow(target.x - character.x, 2) + Math.pow(target.y - character.y, 2));
        const duration = distance / 150;
        this.moveTo(character, target, duration);
    }
}