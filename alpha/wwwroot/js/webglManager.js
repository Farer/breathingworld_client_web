// /js/webglManager.js
'use strict';

import { TextureLoader } from './textureLoader.js';

export class WebGLManager {
    constructor(canvas) {
        if (!canvas) throw new Error('Canvas element required');
        
        this.canvas = canvas;
        this.isReady = false;
        this.isRunning = false;
        
        // WebGL 컨텍스트 초기화
        this.gl = this.initWebGL(canvas);
        if (!this.gl) {
            throw new Error('WebGL 2.0 not supported');
        }
        
        // 텍스처 로더 (Worker 사용)
        this.textureLoader = new TextureLoader(this.gl);
        
        // 렌더링 레이어들
        this.layers = {
            ground: [],
            weed: [],
            shadow: [],
            entity: []
        };
        
        // 텍스처 저장소
        this.textures = {
            ground: [],
            weed: [],
            trees: [],
            shadow: null,
            rabbit: {},
            wolf: {},
            eagle: {}
        };
        
        // 렌더링 루프 관련
        this.lastTime = 0;
        this.deltaTime = 0;
        
        // Scale 관리
        this.currentScale = 1;
        this.loadingController = null;
        this.isLoading = false;
        this.frameSkip = 1;
        
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
        
        console.log('🎮 WebGLManager created');
    }
    
    // ✅ WebGL 컨텍스트 초기화 (내부 메서드)
    initWebGL(canvas) {
        const gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false
        });
        
        if (!gl) {
            console.error('❌ WebGL 2.0 not supported');
            return null;
        }
        
        // 기본 설정
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // 뷰포트 설정
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        console.log('✅ WebGL 2.0 context initialized');
        console.log('   Max texture size:', gl.getParameter(gl.MAX_TEXTURE_SIZE));
        console.log('   Max texture units:', gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
        
        return gl;
    }
    
    // ✅ 엔진 초기화
    async init() {
        console.log('🔧 Initializing WebGLManager...');
        
        try {
            // 1. 텍스처 로더 초기화 (Basis transcoder)
            await this.textureLoader.init();
            console.log('✅ TextureLoader initialized');
            
            // 2. 셰이더 컴파일
            await this.initShaders();
            console.log('✅ Shaders compiled');
            
            // 3. 기본 에셋 로드
            await this.loadBasicAssets();
            console.log('✅ Basic assets loaded');
            
            this.isReady = true;
            console.log('🎉 WebGLManager ready!');
            
        } catch (error) {
            console.error('❌ WebGLManager initialization failed:', error);
            throw error;
        }
    }
    
    async initShaders() {
        // TODO: 셰이더 초기화
        console.log('   (Shaders initialization pending...)');
    }
    
    async loadBasicAssets() {
        // 그림자 텍스처 생성
        this.textures.shadow = this.createShadowTexture();
        console.log('   (Asset loading pending...)');
    }
    
    createShadowTexture() {
        const gl = this.gl;
        const size = 256;
        const data = new Uint8Array(size * size * 4);
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = (x - size / 2) / (size / 2);
                const dy = (y - size / 2) / (size / 2);
                const distance = Math.sqrt(dx * dx + dy * dy);
                const alpha = Math.max(0, 1 - distance) * 0.3;
                
                const index = (y * size + x) * 4;
                data[index + 0] = 0;
                data[index + 1] = 0;
                data[index + 2] = 0;
                data[index + 3] = Math.floor(alpha * 255);
            }
        }
        
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        return texture;
    }
    
    // ================== Scale 관리 시스템 ==================
    
    // ✅ Scale 변경 메인 함수
    async applyScale(newScale) {
        // 유효성 검증
        const validScales = [1, 2, 4, 8, 16, 32, 64, 128];
        if (!validScales.includes(newScale)) {
            console.warn(`Invalid scale: ${newScale}`);
            return;
        }
        
        // 동일한 scale이면 무시
        if (this.currentScale === newScale) {
            return;
        }
        
        console.log(`🔄 Applying scale: ${this.currentScale} → ${newScale}`);
        
        // Scale 4 이하일 때는 즉시 모든 작업 중단 및 메모리 정리
        if (newScale <= 4) {
            console.log(`⚠️ Scale ${newScale} <= 4: Stopping all operations and clearing memory`);
            
            // 1. 진행 중인 로딩 즉시 중단
            this.stopAllLoading();
            
            // 2. 모든 텍스처 메모리에서 제거
            this.clearAllTextures();
            
            // 3. Scale 업데이트
            this.currentScale = newScale;
            
            console.log(`✅ Scale ${newScale}: All textures cleared, loading stopped`);
            return;
        }
        
        // Scale 8 이상일 때 처리
        // 1. 진행 중인 로딩 중단
        this.stopAllLoading();
        
        // 2. 기존 텍스처 정리
        this.clearAllTextures();
        
        // 3. Scale 업데이트
        this.currentScale = newScale;
        
        // 4. 새 텍스처 로드
        this.loadingController = new AbortController();
        this.isLoading = true;
        
        try {
            await this.loadAllTexturesForScale(newScale);
            console.log(`✅ Scale ${newScale} textures loaded`);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Texture loading failed:', error);
            }
        } finally {
            this.isLoading = false;
            this.loadingController = null;
        }
    }
    
    // ✅ 모든 로딩 작업 중단
    stopAllLoading() {
        if (this.loadingController) {
            this.loadingController.abort();
            this.loadingController = null;
        }
        this.isLoading = false;
        console.log('⏹️ All loading operations stopped');
    }
    
    // ✅ 모든 텍스처 메모리 정리
    clearAllTextures() {
        const gl = this.gl;
        let deletedCount = 0;
        let failedCount = 0;
        
        // 모든 동물 텍스처 삭제
        for (const species in this.textures) {
            // shadow와 기타 특수 텍스처는 유지
            if (species === 'shadow' || species === 'ground' || species === 'weed' || species === 'trees') {
                continue;
            }
            
            // 동물 텍스처 삭제
            for (const lifeStage in this.textures[species]) {
                for (const animation in this.textures[species][lifeStage]) {
                    for (const direction in this.textures[species][lifeStage][animation]) {
                        const frames = this.textures[species][lifeStage][animation][direction];
                        if (Array.isArray(frames)) {
                            frames.forEach(texture => {
                                if (texture) {
                                    try {
                                        // WebGL 텍스처 삭제 시도
                                        gl.deleteTexture(texture);
                                        deletedCount++;
                                    } catch (error) {
                                        // 삭제 실패 (WebGLTexture가 아닌 경우)
                                        failedCount++;
                                    }
                                }
                            });
                        }
                    }
                }
            }
            // 텍스처 객체 초기화
            this.textures[species] = {};
        }
        
        if (failedCount > 0) {
            console.log(`🗑️ Cleared ${deletedCount} textures from GPU memory (${failedCount} skipped)`);
        } else {
            console.log(`🗑️ Cleared ${deletedCount} textures from GPU memory`);
        }
    }
    
    // ✅ Scale에 해당하는 모든 텍스처 로드
    async loadAllTexturesForScale(scale) {
        console.log(`📦 Loading all textures for scale ${scale}...`);
        
        // 기기 사양에 따른 프레임 스킵 설정
        this.frameSkip = this.detectDeviceCapability();
        console.log(`   Frame skip: ${this.frameSkip} (1 = load all, 2 = load every 2nd frame)`);
        
        // 현재는 rabbit의 adult만 로드
        const species = 'rabbit';
        const config = this.animalConfig[species];
        
        for (const lifeStage of config.lifeStages) {
            await this.loadAnimalTextures(
                species,
                lifeStage,
                scale,
                config.animations,
                config.frameCount
            );
        }
    }
    
    // ✅ 개별 동물의 모든 텍스처 로드
    async loadAnimalTextures(species, lifeStage, scale, animations, frameCount) {
        const basePath = `/img/ktx2/${species}/${lifeStage}/${scale}`;
        
        // 텍스처 객체 초기화
        if (!this.textures[species][lifeStage]) {
            this.textures[species][lifeStage] = {};
        }
        
        let totalLoaded = 0;
        let totalFailed = 0;
        
        for (const animation of animations) {
            const maxFrames = frameCount[animation];
            
            if (!this.textures[species][lifeStage][animation]) {
                this.textures[species][lifeStage][animation] = {};
            }
            
            // 16방향 모두 로드
            for (let dir = 0; dir < 16; dir++) {
                const direction = `direction_${String(dir).padStart(2, '0')}`;
                const frames = [];
                
                // 프레임 로드 (스킵 적용)
                for (let frame = 0; frame < maxFrames; frame += this.frameSkip) {
                    const frameStr = String(frame).padStart(4, '0');
                    const url = `${basePath}/${animation}/${direction}/frame_${frameStr}.ktx2`;
                    
                    try {
                        const textureData = await this.loadTextureWithAbort(url);
                        frames.push(textureData);  // 전체 textureData 객체 저장
                        totalLoaded++;
                        
                        // 진행 상황 로그 (100개마다)
                        if (totalLoaded % 100 === 0) {
                            console.log(`   Loaded ${totalLoaded} textures...`);
                        }
                    } catch (error) {
                        if (error.name === 'AbortError') {
                            console.log('   Loading aborted by user');
                            return;
                        }
                        console.error(`   Failed to load: ${url}`, error);
                        totalFailed++;
                    }
                }
                
                // 텍스처 저장
                this.textures[species][lifeStage][animation][direction] = frames;
            }
        }
        
        console.log(`✅ ${species}/${lifeStage}: Loaded ${totalLoaded} textures, Failed ${totalFailed}`);
    }
    
    // ✅ AbortController와 함께 텍스처 로드
    async loadTextureWithAbort(url) {
        if (!this.loadingController) {
            throw new Error('No loading controller available');
        }
        
        // KTX2 로더는 내부적으로 fetch를 사용하므로
        // AbortSignal 처리를 위해 Promise 래핑
        return new Promise(async (resolve, reject) => {
            // loadingController가 중간에 null이 될 수 있으므로 참조 저장
            const controller = this.loadingController;
            if (!controller) {
                reject(new DOMException('Aborted', 'AbortError'));
                return;
            }
            
            const abortListener = () => {
                reject(new DOMException('Aborted', 'AbortError'));
            };
            
            controller.signal.addEventListener('abort', abortListener);
            
            try {
                const data = await this.textureLoader.loadKTX2(url);
                
                // 로딩 완료 후 controller 유효성 재확인
                if (controller.signal.aborted) {
                    reject(new DOMException('Aborted', 'AbortError'));
                    return;
                }
                
                controller.signal.removeEventListener('abort', abortListener);
                resolve(data);
            } catch (error) {
                if (controller && controller.signal) {
                    controller.signal.removeEventListener('abort', abortListener);
                }
                reject(error);
            }
        });
    }
    
    // ✅ 기기 사양 감지 및 프레임 스킵 결정
    detectDeviceCapability() {
        const gl = this.gl;
        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        
        // 모바일 기기 감지
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        
        // 메모리 추정 (간접적)
        const deviceMemory = navigator.deviceMemory || 4; // GB 단위, 기본값 4GB
        
        console.log(`   Device info: Mobile=${isMobile}, Memory≈${deviceMemory}GB, MaxTexture=${maxTextureSize}`);
        
        // 프레임 스킵 결정
        if (isMobile || deviceMemory <= 2) {
            return 3; // 저사양: 3프레임마다 로드
        } else if (deviceMemory <= 4 || maxTextureSize < 8192) {
            return 2; // 중간사양: 2프레임마다 로드
        } else {
            return 1; // 고사양: 모든 프레임 로드
        }
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
    
    // ✅ 특정 텍스처 준비 상태 확인
    isTextureReady(species, lifeStage, animation, direction, frameIndex) {
        try {
            const frames = this.textures[species][lifeStage][animation][direction];
            return frames && frames[frameIndex] !== undefined;
        } catch {
            return false;
        }
    }
    
    // ================== 기존 메서드들 ==================
    
    // ✅ 렌더링 루프 시작 (내부에서 관리)
    startRenderLoop() {
        if (this.isRunning) {
            console.warn('⚠️ Render loop already running');
            return;
        }
        
        this.isRunning = true;
        this.lastTime = performance.now();
        
        console.log('🎬 Starting render loop...');
        
        const loop = (timestamp) => {
            if (!this.isRunning) return;
            
            // Delta time 계산
            this.deltaTime = (timestamp - this.lastTime) / 1000;
            this.lastTime = timestamp;
            
            // 업데이트 & 렌더링
            this.update(this.deltaTime);
            this.render();
            
            // 다음 프레임
            requestAnimationFrame(loop);
        };
        
        requestAnimationFrame(loop);
    }
    
    // ✅ 렌더링 루프 중지
    stopRenderLoop() {
        this.isRunning = false;
        console.log('⏸️ Render loop stopped');
    }
    
    // ✅ 업데이트 (게임 로직)
    update(dt) {
        // TODO: 엔티티 업데이트, 애니메이션 등
    }
    
    // ✅ 렌더링
    render() {
        const gl = this.gl;
        
        // 화면 클리어
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // TODO: 실제 렌더링
    }
    
    // ✅ 리사이즈 처리
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
        
        console.log(`📐 Canvas resized: ${width}x${height}`);
    }
    
    // ✅ 정리
    cleanup() {
        console.log('🧹 Cleaning up WebGLManager...');
        
        // 렌더링 루프 중지
        this.stopRenderLoop();
        
        // 모든 로딩 중단
        this.stopAllLoading();
        
        // 텍스처 정리
        this.clearAllTextures();
        
        // 텍스처 로더 정리
        if (this.textureLoader) {
            this.textureLoader.destroy();
        }
        
        console.log('✅ WebGLManager cleaned up');
    }
}