'use strict';
export class PixiManager {
    constructor(targetElement) {
        this.isReady = false;
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
            throw new Error("invalid targetElement");
        }
        this._init(targetElement);
    }

    async _init(targetElement) {
        this.app = new PIXI.Application();
        await this.app.init({
            backgroundAlpha: 0,
            resizeTo: window,
        });
        targetElement.appendChild(this.app.view);

        this.shadowLayer = new PIXI.Container();
        this.shadowLayer.sortableChildren = true;

        this.grassLayer = new PIXI.Container();
        this.grassLayer.sortableChildren = true;

        this.entityLayer = new PIXI.Container();
        this.entityLayer.sortableChildren = true;

        this.app.stage.addChild(this.grassLayer, this.shadowLayer, this.entityLayer);
        await this.loadAssets();
        this.isReady = true;
    }
    
    async loadAssets() {
        // --- 그림자 텍스처를 코드로 생성 ---
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

    createTree(stageIndex) {
        if (stageIndex < 0 || stageIndex >= this.textures.trees.length) return null;
        
        const tree = new PIXI.Sprite(this.textures.trees[stageIndex]);
        tree.anchor.set(0.5, 1.0);
        tree.entityType = 'tree'; // <<< 타입 저장
        this.entityLayer.addChild(tree);

        const shadow = new PIXI.Sprite(this.textures.shadow);
        shadow.anchor.set(0.5, 0.5);
        this.shadowLayer.addChild(shadow);
        tree.shadow = shadow;
        tree.shadowOffsetY = -200;

        return tree;
    }
    
    createGrass(stageIndex) {
        if (stageIndex < 0 || stageIndex >= this.textures.grass.length) return null;

        const grass = new PIXI.Sprite(this.textures.grass[stageIndex]);
        grass.anchor.set(0.5, 1.0);
        grass.entityType = 'grass'; // <<< 타입 저장
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
        animal.entityType = name; // <<< 타입 저장 ('rabbit' 또는 'wolf')
        this.entityLayer.addChild(animal);

        const shadow = new PIXI.Sprite(this.textures.shadow);
        shadow.anchor.set(0.5, 0.5);
        this.shadowLayer.addChild(shadow);
        animal.shadow = shadow;
        animal.shadowOffsetY = -20;
        if(name == 'rabbit') {
            animal.shadowWidthRatio = 0.6;
        } else if(name == 'wolf') {
            animal.shadowWidthRatio = 0.8;
        }

        return animal;
    }
}