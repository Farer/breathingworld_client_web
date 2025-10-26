'use strict';

import { WebGPUManager } from './webGPUManager.js';

/**
 * WebGPU 기반 컨트롤러
 * - 기존 PixiController와 동일한 인터페이스 제공
 * - 엔티티 관리 및 애니메이션 처리
 */
export class WebGPUController {
    constructor(container, TWEEN, worker) {
        this._debug = true;
        this._statUpdateCounter = 0;
        this._cachedVisibleCount = 0;
        this._cachedPoolStats = '';
        
        // Safari 감지
        this._isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (this._isSafari) {
            console.warn("🧩 Safari detected — enabling safety limits");
        }
        
        // 성능 모니터링
        this._fpsHistory = [];
        this._performanceWarningShown = false;
        
        // WebGPU 매니저
        this.webGPUManager = new WebGPUManager(container, worker);
        this.TWEEN = TWEEN;
        this.worker = worker;
        
        // 엔티티 관리
        this.activeGround = new Map();
        this.activeWeed = new Map();
        this.allEntities = new Map();
        
        // 객체 풀
        this.pools = {
            ground: [],
            weed: [],
            tree: [],
            rabbit: [],
            wolf: [],
        };
        
        // 통계
        this.stats = {
            fps: 0,
            entityCount: 0,
            textureMemory: 0,
            poolEfficiency: 'N/A'
        };
        
        // 디바이스 성능 감지
        this._lastFrameTime = 0;
        this._deviceTier = this._detectDeviceTier();
        this._targetFPS = this._deviceTier === 'low' ? 30 : 45;
        this.MAX_VISIBLE_ENTITIES = this._deviceTier === 'low' ? 50 : 100;
        
        // 씬 데이터
        this.newSceneData = [];
        this._populatingScene = false;
        
        // 스프라이트 ID 카운터
        this._spriteIdCounter = 0;
    }
    
    /**
     * 비동기 팩토리 메서드
     */
    static async create(container, TWEEN, worker) {
        const controller = new WebGPUController(container, TWEEN, worker);
        await controller._init();
        return controller;
    }
    
    /**
     * 초기화
     */
    async _init() {
        await this.webGPUManager.init();
        
        // 업데이트 루프 시작
        this.startUpdateLoop();
        
        console.log('✅ WebGPU Controller initialized');
    }
    
    /**
     * 디바이스 성능 감지
     */
    _detectDeviceTier() {
        const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
        const cores = navigator.hardwareConcurrency || 2;
        const memory = navigator.deviceMemory || 2;
        
        if (!isMobile && cores >= 8 && memory >= 8) return 'high';
        if (cores >= 4 && memory >= 4) return 'medium';
        return 'low';
    }
    
    /**
     * 업데이트 루프
     */
    startUpdateLoop() {
        const update = (timestamp) => {
            const deltaTime = timestamp - this._lastFrameTime;
            this._lastFrameTime = timestamp;
            
            // TWEEN 업데이트
            if (this.TWEEN) {
                this.TWEEN.update(timestamp);
            }
            
            // 엔티티 업데이트
            this.updateEntities(deltaTime);
            
            // 통계 업데이트
            this.updateStats();
            
            requestAnimationFrame(update);
        };
        
        requestAnimationFrame(update);
    }
    
    /**
     * 엔티티 업데이트
     */
    updateEntities(deltaTime) {
        // 가시성 체크 및 culling
        const visibleEntities = this.performCulling();
        
        // 애니메이션 업데이트
        for (const entity of visibleEntities) {
            if (entity.animations) {
                this.updateAnimation(entity, deltaTime);
            }
            
            // 그림자 업데이트
            if (entity.shadow) {
                this.updateShadow(entity);
            }
        }
    }
    
    /**
     * 화면 밖 엔티티 culling
     */
    performCulling() {
        const visible = [];
        const margin = 100; // 화면 밖 여유 마진
        
        const screenBounds = {
            left: -margin,
            right: window.innerWidth + margin,
            top: -margin,
            bottom: window.innerHeight + margin
        };
        
        for (const entity of this.allEntities.values()) {
            if (this.isInBounds(entity, screenBounds)) {
                entity.visible = true;
                visible.push(entity);
            } else {
                entity.visible = false;
            }
        }
        
        this._cachedVisibleCount = visible.length;
        return visible;
    }
    
    /**
     * 경계 체크
     */
    isInBounds(entity, bounds) {
        return entity.x >= bounds.left && 
               entity.x <= bounds.right &&
               entity.y >= bounds.top && 
               entity.y <= bounds.bottom;
    }
    
    /**
     * 애니메이션 업데이트
     */
    updateAnimation(entity, deltaTime) {
        if (!entity.animationData) return;
        
        const anim = entity.animationData;
        anim.currentTime += deltaTime * anim.speed;
        
        const frameDuration = 1000 / anim.fps;
        if (anim.currentTime >= frameDuration) {
            anim.currentFrame = (anim.currentFrame + 1) % anim.totalFrames;
            anim.currentTime = 0;
            
            // 텍스처 업데이트
            this.updateEntityTexture(entity, anim.currentFrame);
        }
    }
    
    /**
     * 그림자 업데이트
     */
    updateShadow(entity) {
        if (!entity.shadow) return;
        
        entity.shadow.x = entity.x;
        entity.shadow.y = entity.y + (entity.shadowOffsetY || 0);
        entity.shadow.scale = entity.scale * (entity.shadowWidthRatio || 1);
    }
    
    /**
     * 객체 빌리기 (풀에서 재사용 또는 새로 생성)
     */
    borrowObject(species, lifeStage, stage) {
        const currentScale = Variables.MapScaleInfo.current;
        const usePool = currentScale < 128;
        const pool = usePool ? this.pools[species] : null;
        
        let entity = null;
        
        // 풀에서 가져오기
        if (pool && pool.length > 0) {
            entity = pool.pop();
            entity.visible = true;
            if (entity.shadow) entity.shadow.visible = true;
            
            // 텍스처 업데이트
            if (species === 'tree' || species === 'weed') {
                this.updateStaticTexture(entity, species, stage);
            }
        } else {
            // 새로 생성
            entity = this.createEntity(species, lifeStage, stage);
        }
        
        return entity;
    }
    
    /**
     * 엔티티 생성
     */
    createEntity(species, lifeStage, stage) {
        const entityId = `${species}_${this._spriteIdCounter++}`;
        
        const entity = {
            id: entityId,
            entityType: species,
            lifeStage: lifeStage,
            stage: stage,
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            visible: true,
            opacity: 1,
            anchor: { x: 0.5, y: 0.5 }
        };
        
        // 레이어 결정
        let layerName = 'entity';
        if (species === 'ground') layerName = 'ground';
        else if (species === 'weed') layerName = 'weed';
        
        // WebGPU 매니저에 등록
        this.webGPUManager.layers[layerName].sprites.set(entityId, entity);
        
        // 타입별 설정
        switch (species) {
            case 'ground':
                entity.anchor = { x: 0, y: 0 };
                this.activeGround.set(entityId, entity);
                break;
                
            case 'weed':
                entity.anchor = { x: 0.5, y: 1 };
                this.activeWeed.set(entityId, entity);
                break;
                
            case 'tree':
                entity.anchor = { x: 0.5, y: 1 };
                this.addShadow(entity, -250, 1.4);
                this.allEntities.set(entityId, entity);
                break;
                
            case 'rabbit':
            case 'wolf':
            case 'eagle':
                entity.anchor = { x: 0.5, y: 1 };
                entity.animationData = this.createAnimationData(species, lifeStage);
                this.addShadow(entity, species === 'rabbit' ? -130 : -20, 
                             species === 'rabbit' ? 0.4 : 0.3);
                this.allEntities.set(entityId, entity);
                break;
        }
        
        // 초기 텍스처 로드
        this.loadEntityTexture(entity, species, lifeStage, stage);
        
        return entity;
    }
    
    /**
     * 애니메이션 데이터 생성
     */
    createAnimationData(species, lifeStage) {
        const animConfig = {
            rabbit: { fps: 22, speed: 1.0 },
            wolf: { fps: 15, speed: 0.8 },
            eagle: { fps: 20, speed: 1.2 }
        };
        
        const config = animConfig[species] || { fps: 15, speed: 1.0 };
        
        return {
            currentFrame: 0,
            totalFrames: 60, // 기본값, 실제 로드 후 업데이트
            currentTime: 0,
            fps: config.fps,
            speed: config.speed,
            currentAnimation: 'idle_1',
            currentDirection: 'direction_0'
        };
    }
    
    /**
     * 그림자 추가
     */
    addShadow(entity, offsetY, widthRatio) {
        const shadowId = `${entity.id}_shadow`;
        
        const shadow = {
            id: shadowId,
            entityType: 'shadow',
            x: entity.x,
            y: entity.y + offsetY,
            scale: entity.scale * widthRatio,
            rotation: 0,
            visible: true,
            opacity: 0.2
        };
        
        entity.shadow = shadow;
        entity.shadowOffsetY = offsetY;
        entity.shadowWidthRatio = widthRatio;
        
        this.webGPUManager.layers.shadow.sprites.set(shadowId, shadow);
    }
    
    /**
     * 엔티티 텍스처 로드
    /**
     * 엔티티 텍스처 로드 - 애니메이션 시스템 통합
     */
    async loadEntityTexture(entity, species, lifeStage, stage) {
        switch (species) {
            case 'ground':
                const groundUrl = '/img/sprites/sprite_ground_with_droppings_rgba_opti.png';
                const groundTexture = await this.webGPUManager.loadTexture(groundUrl);
                entity.textureBindGroup = groundTexture.bindGroup;
                entity.width = groundTexture.width;
                entity.height = groundTexture.height;
                break;
                
            case 'weed':
                const weedUrl = '/img/sprites/sprite_weed_512_opti.png';
                const weedTexture = await this.webGPUManager.loadTexture(weedUrl);
                entity.textureBindGroup = weedTexture.bindGroup;
                entity.width = weedTexture.width;
                entity.height = weedTexture.height;
                break;
                
            case 'tree':
                const treeUrl = `/img/tree_${stage}_tiny.png`;
                const treeTexture = await this.webGPUManager.loadTexture(treeUrl);
                entity.textureBindGroup = treeTexture.bindGroup;
                entity.width = treeTexture.width;
                entity.height = treeTexture.height;
                break;
                
            case 'rabbit':
            case 'wolf':
            case 'eagle':
                // 동물은 애니메이션 시스템 사용
                const scale = Variables.MapScaleInfo.current;
                
                // 애니메이션 데이터 설정
                entity.animationData = {
                    species: species,
                    lifeStage: lifeStage,
                    scale: scale,
                    currentAnimation: 'idle_1',
                    currentDirection: 0,
                    currentFrame: 0,
                    frameTime: 0,
                    frameDuration: 100, // ms per frame
                    animations: {}
                };
                
                // 애니메이션 텍스처 로드
                await this.loadAnimalAnimations(entity, species, lifeStage, scale);
                
                // 초기 텍스처 설정
                this.updateEntityAnimation(entity);
                break;
        }
    }
    
    /**
     * 동물 애니메이션 텍스처 로드
     */
    async loadAnimalAnimations(entity, species, lifeStage, scale) {
        const baseUrl = this.webGPUManager.getAnimalTextureURL(species, lifeStage, scale);
        const animations = this.getAnimationTypes(species);
        
        // console.log(`[loadAnimalAnimations] Loading for ${species}/${lifeStage} at scale ${scale}`);
        // console.log(`[loadAnimalAnimations] Base URL: ${baseUrl}`);
        // console.log(`[loadAnimalAnimations] Animations to load: ${animations.join(', ')}`);
        
        entity.animationData.animations = {};
        
        for (const animationType of animations) {
            const frameCount = this.getFrameCount(species, animationType);
            // console.log(`[loadAnimalAnimations] ${animationType}: ${frameCount} frames`);
            
            entity.animationData.animations[animationType] = {
                directions: [],
                frameCount: frameCount
            };
            
            // 16방향 (00-15) - 테스트를 위해 처음 2개 방향만
            for (let dir = 0; dir < 2; dir++) {
                const direction = `direction_${dir.toString().padStart(2, '0')}`;
                const frames = [];
                
                // 테스트용으로 프레임 수 제한
                const actualFrameCount = Math.min(3, frameCount);
                // console.log(`[loadAnimalAnimations] Loading ${actualFrameCount} frames for ${animationType}/${direction}`);
                
                for (let frame = 0; frame < actualFrameCount; frame++) {
                    const frameNum = frame.toString().padStart(4, '0');
                    const url = `${baseUrl}/${animationType}/${direction}/frame_${frameNum}.ktx2`;
                    
                    // console.log(`[loadAnimalAnimations] Loading texture: ${url}`);
                    
                    // 텍스처 캐시에서 가져오거나 로드
                    try {
                        const textureData = await this.webGPUManager.loadTexture(url);
                        if (textureData) {
                            frames.push(textureData);
                        }
                    } catch (error) {
                        console.error(`[loadAnimalAnimations] Failed to load ${url}:`, error);
                    }
                }
                
                entity.animationData.animations[animationType].directions.push(frames);
            }
        }
        
        // console.log(`[loadAnimalAnimations] Completed loading animations for entity`);
    }
    
    /**
     * 동물별 애니메이션 타입 반환
     */
    getAnimationTypes(species) {
        if (species === 'rabbit') {
            return ['idle_1']; // 테스트용으로 일단 idle_1만
        }
        return ['idle_1'];
    }
    
    /**
     * 각도를 16방향 인덱스로 변환
     * @param {number} angle - 라디안 각도
     * @returns {number} 0-15 사이의 방향 인덱스
     */
    angleToDirection(angle) {
        // 각도를 0-2π 범위로 정규화
        while (angle < 0) angle += Math.PI * 2;
        while (angle > Math.PI * 2) angle -= Math.PI * 2;
        
        // 16방향으로 변환 (22.5도씩)
        // direction_00은 아래쪽, 시계방향으로 증가
        const segment = Math.PI * 2 / 16;
        let direction = Math.round(angle / segment);
        
        // 0-15 범위로 조정
        return direction % 16;
    }
    
    /**
     * 두 점 사이의 방향 계산
     * @param {number} fromX - 시작 X 좌표
     * @param {number} fromY - 시작 Y 좌표
     * @param {number} toX - 목표 X 좌표
     * @param {number} toY - 목표 Y 좌표
     * @returns {number} 0-15 사이의 방향 인덱스
     */
    getDirectionBetweenPoints(fromX, fromY, toX, toY) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);
        
        // 각도를 16방향 시스템에 맞게 조정 (시계방향)
        // direction_00 = 남쪽 (아래, 6시 방향)
        // direction_04 = 동쪽 (오른쪽, 3시 방향)
        // direction_08 = 북쪽 (위, 12시 방향)
        // direction_12 = 서쪽 (왼쪽, 9시 방향)
        
        // atan2는 오른쪽(3시)을 0도로 반시계방향으로 증가
        // 우리는 아래쪽(6시)을 0으로 시계방향으로 증가하길 원함
        // 따라서: 90도 회전 + 방향 반전
        let adjustedAngle = -angle + Math.PI/2;
        
        // 0-2π 범위로 정규화
        if (adjustedAngle < 0) adjustedAngle += Math.PI * 2;
        
        // 16방향으로 변환
        const segment = Math.PI * 2 / 16;
        let direction = Math.round(adjustedAngle / segment);
        
        return direction % 16;
    }
    
    /**
     * 종별 애니메이션 프레임 수 반환
     */
    getFrameCount(species, animationType) {
        if (species === 'rabbit') {
            switch (animationType) {
                case 'idle_1': return 35;
                case 'idle_2': return 22;
                case 'walk_1': return 21;
                case 'run_1': return 14;
                case 'sleep_3': return 12;
                case 'eat_1': return 1;
                default: return 1;
            }
        }
        return 10;
    }
    
    /**
     * 엔티티 애니메이션 업데이트
     */
    updateEntityAnimation(entity, deltaTime = 0) {
        if (!entity.animationData) return;
        
        const animData = entity.animationData;
        
        // 프레임 시간 업데이트
        animData.frameTime += deltaTime;
        
        // 프레임 전환
        if (animData.frameTime >= animData.frameDuration) {
            animData.frameTime = 0;
            animData.currentFrame++;
            
            const anim = animData.animations[animData.currentAnimation];
            if (anim && animData.currentFrame >= Math.min(5, anim.frameCount)) {
                animData.currentFrame = 0;
            }
        }
        
        // 현재 텍스처 가져오기
        const anim = animData.animations[animData.currentAnimation];
        if (anim && anim.directions[animData.currentDirection]) {
            const frame = anim.directions[animData.currentDirection][animData.currentFrame];
            if (frame) {
                entity.textureBindGroup = frame.bindGroup;
                entity.width = frame.width;
                entity.height = frame.height;
            }
        }
    }
    
    /**
     * 엔티티 애니메이션 설정
     */
    setEntityAnimation(entity, animationType, direction = null) {
        if (!entity.animationData) return;
        
        // 애니메이션 타입 변경
        if (entity.animationData.animations[animationType] && 
            animationType !== entity.animationData.currentAnimation) {
            entity.animationData.currentAnimation = animationType;
            entity.animationData.currentFrame = 0;
            entity.animationData.frameTime = 0;
        }
        
        // 방향 설정 (0-15)
        if (direction !== null) {
            entity.animationData.currentDirection = Math.floor(direction) % 16;
        }
        
        // 텍스처 즉시 업데이트
        this.updateEntityAnimation(entity);
    }
    
    /**
     * 정적 텍스처 업데이트
     */
    updateStaticTexture(entity, species, stage) {
        const textureKey = species === 'tree' ? 'trees' : species;
        // 텍스처 업데이트 로직
        this.loadEntityTexture(entity, species, entity.lifeStage, stage);
    }
    
    /**
     * 엔티티 텍스처 프레임 업데이트
     */
    updateEntityTexture(entity, frameIndex) {
        // 애니메이션 프레임에 맞는 텍스처 설정
        if (entity.animationData) {
            const anim = entity.animationData;
            const textureKey = `${entity.entityType}/${entity.lifeStage}/${anim.currentAnimation}/${anim.currentDirection}/frame_${frameIndex}`;
            
            // 캐시에서 텍스처 가져오기
            const textureData = this.webGPUManager.textureCache.get(textureKey);
            if (textureData) {
                entity.textureBindGroup = textureData.bindGroup;
            }
        }
    }
    
    /**
     * 객체 반환 (풀로 되돌리기)
     */
    returnObject(entity) {
        entity.visible = false;
        if (entity.shadow) entity.shadow.visible = false;
        
        // 진행 중인 애니메이션 정지
        if (entity.activeTween) {
            this.TWEEN.remove(entity.activeTween);
            entity.activeTween = null;
        }
        
        // 타이머 정리
        if (entity.thinkTimer) {
            clearTimeout(entity.thinkTimer);
            entity.thinkTimer = null;
        }
        
        // 풀에 반환
        const pool = this.pools[entity.entityType];
        if (pool && pool.length < 100) { // 풀 최대 크기 제한
            pool.push(entity);
        } else {
            // 완전히 제거
            this.removeEntity(entity);
        }
    }
    
    /**
     * 엔티티 제거
     */
    removeEntity(entity) {
        // 맵에서 제거
        this.allEntities.delete(entity.id);
        this.activeGround.delete(entity.id);
        this.activeWeed.delete(entity.id);
        
        // 레이어에서 제거
        for (const layer of Object.values(this.webGPUManager.layers)) {
            layer.sprites.delete(entity.id);
        }
        
        // 그림자 제거
        if (entity.shadow) {
            this.webGPUManager.layers.shadow.sprites.delete(entity.shadow.id);
        }
    }
    
    /**
     * 씬 채우기
     */
    populateScene(sceneData) {
        if (this._populatingScene) return;
        
        this._populatingScene = true;
        
        if (sceneData) {
            this.newSceneData = sceneData;
        }
        
        for (const data of this.newSceneData) {
            const entity = this.borrowObject(data.species, data.lifeStage, data.stage);
            
            if (entity) {
                entity.x = data.x;
                entity.y = data.y;
                entity.scale = data.baseScale || 1;
                
                // 애니메이션이 있는 엔티티는 초기 행동 설정
                if (entity.entityType === 'rabbit' || entity.entityType === 'wolf') {
                    this.initEntityBehavior(entity);
                }
            }
        }
        
        this._populatingScene = false;
        console.log(`✅ Scene populated with ${this.newSceneData.length} entities`);
    }
    
    /**
     * 엔티티 행동 초기화
     */
    initEntityBehavior(entity) {
        // 초기 대기 후 움직임 시작
        const delay = 2000 + Math.random() * 3000;
        entity.thinkTimer = setTimeout(() => {
            if (entity.visible) {
                this.thinkAndAct(entity);
            }
        }, delay);
    }
    
    /**
     * AI 행동 결정
     */
    thinkAndAct(character) {
        const scaleFactor = Variables.MapScaleInfo.current / 128;
        
        // 스케일에 따라 이동 거리 제한
        const BASE_MAX_DISTANCE = 800;
        const maxMoveDistance = BASE_MAX_DISTANCE * scaleFactor;
        
        // 랜덤 방향 및 거리
        const angle = Math.random() * Math.PI * 2;
        const moveDistance = Math.random() * maxMoveDistance * 0.7 + maxMoveDistance * 0.3;
        
        // 이동 목표 좌표 계산
        let newX = character.x + Math.cos(angle) * moveDistance;
        let newY = character.y + Math.sin(angle) * moveDistance;
        
        // 화면 경계 보정
        const margin = 20;
        newX = Math.min(Math.max(newX, margin), window.innerWidth - margin);
        newY = Math.min(Math.max(newY, margin), window.innerHeight - margin);
        
        const target = { x: newX, y: newY };
        const distance = Math.hypot(target.x - character.x, target.y - character.y);
        
        // 이동 시간 계산
        const BASE_WORLD_SPEED = 150;
        const scaleCompensation = 128 / Variables.MapScaleInfo.current;
        const MIN_DURATION = 0.25;
        const MAX_DURATION = 10.0;
        let duration = (distance / BASE_WORLD_SPEED) * scaleCompensation;
        duration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, duration));
        
        this.moveTo(character, target, duration);
    }
    
    /**
     * 엔티티 이동
     */
    moveTo(character, target, duration) {
        if (!character.visible || character._removing) return;
        
        const distance = Math.hypot(target.x - character.x, target.y - character.y);
        
        // 너무 가까우면 idle 상태로
        if (distance < 5) {
            this.setIdleAnimation(character);
            
            // 다음 행동 예약
            const delay = 5000 + Math.random() * 3000;
            character.thinkTimer = setTimeout(() => {
                if (character.visible) this.thinkAndAct(character);
            }, delay);
            
            return;
        }
        
        // 방향 계산
        const dirIndex = this.getDirectionIndex(character.x, character.y, target.x, target.y);
        
        // 이동 애니메이션 설정
        this.setRunAnimation(character, dirIndex);
        
        // 기존 트윈 제거
        if (character.activeTween) this.TWEEN.remove(character.activeTween);
        if (character.thinkTimer) clearTimeout(character.thinkTimer);
        
        // 이동 트윈
        const tween = new this.TWEEN.Tween(character)
            .to(target, duration * 1000)
            .easing(this.TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                // 그림자 위치 업데이트
                if (character.shadow) {
                    character.shadow.x = character.x;
                    character.shadow.y = character.y + character.shadowOffsetY;
                }
            })
            .onComplete(() => {
                // Idle 상태로 전환
                this.setIdleAnimation(character);
                
                character.activeTween = null;
                const delay = 5000 + Math.random() * 3000;
                character.thinkTimer = setTimeout(() => {
                    if (character.visible) this.thinkAndAct(character);
                }, delay);
            })
            .start();
        
        character.activeTween = tween;
    }
    
    /**
     * 방향 인덱스 계산
     */
    getDirectionIndex(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        
        // Math.atan2는 오른쪽(3시)이 0, 반시계방향으로 증가
        // 우리는 아래쪽(6시)이 0, 시계방향으로 증가 필요
        let angle = Math.atan2(dy, dx);
        
        // 90도 회전 + 방향 반전하여 변환
        let adjustedAngle = -angle + Math.PI/2;
        
        // 0-2π 범위로 정규화
        if (adjustedAngle < 0) adjustedAngle += Math.PI * 2;
        
        // 16방향 인덱스로 변환 (22.5도씩)
        const segment = Math.PI * 2 / 16;
        const dirIndex = Math.round(adjustedAngle / segment) % 16;
        
        return dirIndex;
    }
    
    /**
     * Idle 애니메이션 설정
     */
    setIdleAnimation(character) {
        if (!character.animationData) return;
        
        const randomIdle = Math.random() > 0.5 ? 'idle_1' : 'idle_2';
        character.animationData.currentAnimation = randomIdle;
        character.animationData.speed = 0.5;
        
        // 텍스처 로드
        this.loadAnimationTextures(character, randomIdle);
    }
    
    /**
     * Run 애니메이션 설정
     */
    setRunAnimation(character, directionIndex) {
        if (!character.animationData) return;
        const runName = 'run_1';
        character.animationData.currentAnimation = runName;
        character.animationData.currentDirection = directionIndex;
        character.animationData.speed = 1.0;
        this.loadAnimationTextures(character, runName, directionIndex);
    }
    
    /**
     * 애니메이션 텍스처 로드
     */
    async loadAnimationTextures(character, animation, directionIndex = null) {
        const scale = Variables.MapScaleInfo.current;
        
        const baseUrl = this.webGPUManager.getAnimalTextureURL(
            character.entityType, 
            character.lifeStage, 
            scale
        );
        
        // 방향 결정 (0-15 인덱스를 direction_00 형식으로)
        let direction;
        if (directionIndex !== null) {
            // 인덱스를 2자리 패딩된 문자열로 변환
            direction = `direction_${directionIndex.toString().padStart(2, '0')}`;
        } else if (character.animationData && character.animationData.currentDirection !== undefined) {
            // 이미 인덱스로 저장되어 있으면 변환
            const dirIdx = character.animationData.currentDirection;
            direction = `direction_${dirIdx.toString().padStart(2, '0')}`;
        } else {
            // 기본값
            direction = 'direction_00';
        }
        
        // 프레임별 텍스처 로드
        const frameCount = this.getFrameCount(character.entityType, animation);
        const loadPromises = [];
        
        for (let i = 0; i < frameCount; i++) {
            // 프레임 번호를 4자리 패딩
            const frameNum = i.toString().padStart(4, '0');
            const url = `${baseUrl}/${animation}/${direction}/frame_${frameNum}.ktx2`;
            loadPromises.push(this.webGPUManager.loadTexture(url, 1));
        }
        
        await Promise.all(loadPromises);
        
        // 프레임 수 업데이트
        if (character.animationData) {
            character.animationData.frameCount = frameCount;
            character.animationData.totalFrames = frameCount;
        }
    }
    
    
    /**
     * 풀 효율성 계산
     */
    _calculatePoolEfficiency() {
        const total = Object.values(this.pools)
            .reduce((sum, pool) => sum + pool.length, 0);
        const active = this.allEntities.size + this.activeWeed.size + this.activeGround.size;
        return total > 0 ? (active / (active + total) * 100).toFixed(1) + '%' : 'N/A';
    }
    
    /**
     * 통계 업데이트
     */
    updateStats() {
        this._statUpdateCounter++;
        
        if (this._statUpdateCounter % 60 === 0) { // 1초마다
            const gpuStats = this.webGPUManager.getStats();
            
            this.stats = {
                fps: gpuStats.fps,
                entityCount: this.allEntities.size + this.activeGround.size + this.activeWeed.size,
                textureMemory: gpuStats.textureMemory,
                poolEfficiency: this._calculatePoolEfficiency(),
                cacheEfficiency: gpuStats.cacheEfficiency,
                drawCalls: gpuStats.drawCalls
            };
            
            // 디버그 출력
            if (this._debug && this._statUpdateCounter % 300 === 0) { // 5초마다
                // console.log('📊 Stats:', this.stats);
                this.showStat();
            }
        }
    }

    showStat() {
        const statDomId = 'webGlStatDom';
        let statDom = Variables.Doms.get(statDomId);
        if (!this._debug) {
            if (statDom) {
                statDom.parentNode.removeChild(statDom);
                Variables.Doms.delete(statDomId);
            }
            return;
        }
        if (!statDom) {
            statDom = document.createElement('div');
            statDom.id = statDomId;
            statDom.style.position = 'absolute';
            statDom.style.left = '0px';
            statDom.style.top = '0px';
            statDom.style.width = '220px';
            statDom.style.height = '120px';
            statDom.style.fontSize = '11px';
            statDom.style.background = 'rgba(0,0,0,0.7)';
            statDom.style.color = '#0f0';
            statDom.style.padding = '5px';
            statDom.style.fontFamily = 'monospace';
            document.body.appendChild(statDom);
            Variables.Doms.set(statDomId, statDom);
        }

        let html = '';
        html += `FPS: ${this.stats.fps} / ${this._targetFPS}`;
        html += `<br>Entities: ${this.stats.entityCount} (${this._cachedVisibleCount} visible)`; // ✅ 캐시 사용
        html += `<br>Active: G:${this.activeGround.size} W:${this.activeWeed.size} E:${this.allEntities.size}`;
        html += `<br>Texture Memory: ${this.stats.textureMemory}`;
        html += `<br>Pool Efficiency: ${this.stats.poolEfficiency}`;
        html += `<br>Cache Efficiency: ${this.stats.cacheEfficiency}`;
        html += `<br>DrawCalls: ${this.stats.drawCalls}`;
        statDom.innerHTML = html;
    }
    
    /**
     * 씬 데이터 초기화
     */
    clearSceneData() {
        this.newSceneData = [];
        this.webGPUManager.clearSceneData();
    }
    
    /**
     * 씬 초기화
     */
    clearScene() {
        // 모든 엔티티 정리
        for (const entity of this.allEntities.values()) {
            this.returnObject(entity);
        }
        for (const entity of this.activeGround.values()) {
            this.returnObject(entity);
        }
        for (const entity of this.activeWeed.values()) {
            this.returnObject(entity);
        }
        
        // 맵 초기화
        this.allEntities.clear();
        this.activeGround.clear();
        this.activeWeed.clear();
        
        // WebGPU 씬 초기화
        this.webGPUManager.clearScene();
        
        console.log('🧹 Scene cleared');
    }
    
    /**
     * 새 엔티티 채우기
     */
    populateNewEntities() {
        this.newSceneData = [];
        
        // 예제 데이터 생성
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            
            this.newSceneData.push({
                category: 'animal',
                species: 'rabbit',
                lifeStage: 'adult',
                x: x,
                y: y,
                baseScale: 0.4 + Math.random() * 0.4
            });
        }
        
        if (!this.webGPUManager._onLoadingAnimalFrames) {
            this.populateScene();
        }
    }
    
    /**
     * 정리
     */
    cleanup() {
        console.log('🧹 Cleaning up WebGPU Controller...');
        
        // 모든 타이머 정리
        for (const entity of this.allEntities.values()) {
            if (entity.thinkTimer) {
                clearTimeout(entity.thinkTimer);
            }
            if (entity.activeTween) {
                this.TWEEN.remove(entity.activeTween);
            }
        }
        
        // 엔티티 맵 정리
        this.allEntities.clear();
        this.activeGround.clear();
        this.activeWeed.clear();
        
        // 풀 정리
        for (const pool of Object.values(this.pools)) {
            pool.length = 0;
        }
        
        // WebGPU 매니저 정리
        if (this.webGPUManager) {
            this.webGPUManager.cleanup();
        }
        
        console.log('✅ WebGPU Controller cleanup complete');
    }
    /**
     * 메인 업데이트 루프
     */
    update(deltaTime) {
        // 애니메이션이 있는 모든 엔티티 업데이트
        this.allEntities.forEach(entity => {
            if (entity.animationData) {
                this.updateEntityAnimation(entity, deltaTime);
            }
        });
        
        // TWEEN 애니메이션 업데이트
        if (this.tween) {
            this.tween.update();
        }
    }
    
    /**
     * 프레임별 렌더링
     */
    renderFrame() {
        const now = performance.now();
        const deltaTime = now - (this.lastFrameTime || now);
        this.lastFrameTime = now;
        
        // 업데이트
        this.update(deltaTime);
        
        // WebGPU 렌더링
        if (this.webGPUManager) {
            this.webGPUManager.render();
        }
        
        requestAnimationFrame(() => this.renderFrame());
    }
    
    /**
     * 렌더링 루프 시작
     */
    startRenderLoop() {
        this.lastFrameTime = performance.now();
        this.renderFrame();
    }
}