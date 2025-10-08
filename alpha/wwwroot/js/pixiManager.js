'use strict';
class PixiManager {
    /**
     * PixiManager 생성자
     * @param {HTMLElement} targetElement - PixiJS 캔버스를 추가할 DOM 요소입니다.
     */
    constructor(targetElement) {
        this.app = null;
        this.textures = {
            shadow: null,
            trees: [],
            grass: [],
            rabbit: {},
            wolf: {},
        };
        this.shadowLayer = null;
        this.grassLayer = null;
        this.entityLayer = null;

        if (!targetElement) {
            throw new Error("PixiManager를 초기화할 대상 DOM 요소가 필요합니다.");
        }
        this._init(targetElement);
    }

    /**
     * PixiJS 애플리케이션을 초기화하고 에셋을 로드합니다.
     * @private
     */
    async _init(targetElement) {
        // 1. PixiJS 애플리케이션 생성
        this.app = new PIXI.Application();
        await this.app.init({
            backgroundColor: 0x2c3e50,
            resizeTo: window,
        });
        targetElement.appendChild(this.app.view);

        // 2. 렌더링 레이어 생성 및 설정
        this.shadowLayer = new PIXI.Container();
        this.shadowLayer.sortableChildren = true;

        this.grassLayer = new PIXI.Container();
        this.grassLayer.sortableChildren = true;

        this.entityLayer = new PIXI.Container();
        this.entityLayer.sortableChildren = true;

        // 3. Stage에 레이어를 올바른 렌더링 순서대로 추가
        // grass -> shadow -> entity 순서로 그려집니다.
        this.app.stage.addChild(this.grassLayer, this.shadowLayer, this.entityLayer);
        
        console.log("PixiJS 초기화 완료. 에셋 로딩을 시작합니다...");
        await this.loadAssets();
        console.log("모든 에셋 로딩 및 처리 완료. PixiManager가 준비되었습니다.");
    }
    
    async loadAssets() {
        // --- 그림자 텍스처를 코드로 생성 ---
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0x000000, 0.3);
        graphics.drawEllipse(0, 0, 100, 50); // 더 큰 기본 크기 (반지름 100, 50)
        graphics.endFill();

        // 텍스처 생성 시 bounds 명시
        const bounds = new PIXI.Rectangle(-100, -50, 200, 100);
        this.textures.shadow = this.app.renderer.generateTexture(graphics, {
            region: bounds
        });

        const assetManifest = {
            bundles: [{
                name: 'game-assets',
                assets: {
                    'grassSheet': '/img/sprites/sprite_weed_512_opti.png',
                    'rabbitSheet': '/img/sprites/sprite_rabbit_256_tiny.png',
                    'wolfSheet': '/img/sprites/sprite_wolf_256_tiny.png',
                },
            }],
        };
        const totalTreeStages = 12;
        for (let i = 0; i < totalTreeStages; i++) {
            assetManifest.bundles[0].assets[`treeStage${i}`] = `img/tree_${i}_tiny.png`;
        }
        await PIXI.Assets.init({ manifest: assetManifest });
        const loadedAssets = await PIXI.Assets.loadBundle('game-assets');
        for (let i = 0; i < totalTreeStages; i++) {
            this.textures.trees.push(loadedAssets[`treeStage${i}`]);
        }
        this.textures.grass = this._parseGridSpriteSheet(loadedAssets.grassSheet, 512, 512, 4, 17);
        this.textures.rabbit = this._parseAnimalSheet(loadedAssets.rabbitSheet, 256, { idle: 10, run: 24, eat: 21, jump: 61, sleep: 61 });
        this.textures.wolf = this._parseAnimalSheet(loadedAssets.wolfSheet, 256, { idle: 60, run: 41, eat: 20, jump: 51, sleep: 60, howl: 60 });
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

    // --- Public 팩토리 메소드 ---

    createTree(stageIndex) {
        if (stageIndex < 0 || stageIndex >= this.textures.trees.length) return null;
        
        const tree = new PIXI.Sprite(this.textures.trees[stageIndex]);
        tree.anchor.set(0.5, 1.0);
        this.entityLayer.addChild(tree);

        // 그림자 생성 및 연결 (수정됨)
        const shadow = new PIXI.Sprite(this.textures.shadow);
        shadow.anchor.set(0.5, 0.5);
        // 그림자 초기 위치를 나무 위치에 맞춤
        shadow.x = tree.x;
        shadow.y = tree.y; // 발 아래 약간 아래쪽에 위치
        shadow.scale.set(1.5); // 나무는 크므로 그림자도 크게

        tree.shadowOffsetY = -200; // 그림자 높이 오프셋 저장
        this.shadowLayer.addChild(shadow);
        tree.shadow = shadow;

        return tree;
    }
    
    /**
     * 지정된 스테이지의 잡초 스프라이트를 생성합니다.
     * @param {number} stageIndex - 0부터 시작하는 잡초 스테이지 인덱스
     * @returns {PIXI.Sprite}
     */
    createGrass(stageIndex) {
        if (stageIndex < 0 || stageIndex >= this.textures.grass.length) {
            console.error("잘못된 잡초 스테이지 인덱스:", stageIndex);
            return null;
        }
        const grass = new PIXI.Sprite(this.textures.grass[stageIndex]);
        grass.anchor.set(0.5, 1.0);
        
        // 잡초를 grassLayer에 추가
        this.grassLayer.addChild(grass);
        
        return grass;
    }

    createAnimal(name, initialAnimation) {
        const animalTextures = this.textures[name];
        if (!animalTextures || !animalTextures[initialAnimation]) return null;
        
        const animal = new PIXI.AnimatedSprite(animalTextures[initialAnimation]);
        animal.anchor.set(0.5, 1.0);
        animal.animationSpeed = 0.2;
        animal.play();
        animal.animations = animalTextures;
        this.entityLayer.addChild(animal);

        // 그림자 생성 및 연결 (수정됨)
        const shadow = new PIXI.Sprite(this.textures.shadow);
        shadow.anchor.set(0.5, 0.5);
        // 그림자 초기 위치를 동물 위치에 맞춤
        shadow.x = animal.x;
        shadow.y = animal.y;
        shadow.scale.set(0.8); // 동물 크기에 맞게 조정

        animal.shadowOffsetY = -20; // 그림자 높이 오프셋 저장
        if(name == 'rabbit') {
            animal.shadowWidthRatio = 0.6; // 그림자 높이 오프셋 저장
        }
        else if(name == 'wolf') {
            animal.shadowWidthRatio = 0.8; // 그림자 높이 오프셋 저장
        }
        this.shadowLayer.addChild(shadow);
        animal.shadow = shadow;

        return animal;
    }
}