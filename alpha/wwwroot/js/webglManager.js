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
        this.currentLoadingPromise = null;  // 현재 진행 중인 로딩 Promise 추적
        
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
            alpha: true,  // 알파 채널 활성화 (투명도 지원)
            antialias: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
            premultipliedAlpha: true  // 알파 블렌딩 개선
        });
        
        if (!gl) {
            console.error('❌ WebGL 2.0 not supported');
            return null;
        }
        
        // 기본 설정 - 투명한 배경
        gl.clearColor(0.0, 0.0, 0.0, 0.0);  // RGBA (0,0,0,0) = 완전 투명
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // 뷰포트 설정
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        console.log('✅ WebGL 2.0 context initialized (transparent background)');
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

    showLoader() {
        Variables.Doms.get('texture-loader').style.opacity = 1;
    }

    hideLoader() {
        Variables.Doms.get('texture-loader').style.opacity = 0;
    }
    
    // ================== Scale 관리 시스템 ==================
    
    // ✅ Scale 변경 메인 함수 (개선된 버전)
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
        
        // 1. 진행 중인 로딩 즉시 중단
        this.stopAllLoading();
        
        // 2. 이전 로딩 Promise가 있다면 완료될 때까지 기다림 (에러 무시)
        if (this.currentLoadingPromise) {
            try {
                await this.currentLoadingPromise;
            } catch {
                // 중단된 Promise의 에러는 무시
            }
            this.currentLoadingPromise = null;
        }
        
        // 3. 기존 텍스처 정리
        this.clearAllTextures();
        
        // 4. Scale 업데이트
        const previousScale = this.currentScale;
        this.currentScale = newScale;
        
        // Scale 4 이하일 때는 텍스처 로드 없이 종료
        if (newScale <= 4) {
            console.log(`✅ Scale ${newScale}: All textures cleared, no loading needed (scale <= 4)`);
            return;
        }
        
        // Scale 8 이상일 때 텍스처 로드
        this.loadingController = new AbortController();
        this.isLoading = true;
        
        // 로딩 Promise 생성 및 저장
        this.currentLoadingPromise = this.loadTexturesForScale(newScale, previousScale);
        
        try {
            await this.currentLoadingPromise;
        } catch (error) {
            // 에러는 loadTexturesForScale 내부에서 처리됨
        } finally {
            this.currentLoadingPromise = null;
        }
    }
    
    // ✅ 텍스처 로딩 Promise 생성 (별도 메서드로 분리)
    async loadTexturesForScale(scale, previousScale) {
        this.showLoader();
        try {
            await this.loadAllTexturesForScale(scale);
            // 현재 scale과 일치할 때만 성공 메시지 출력
            if (this.currentScale === scale) {
                console.log(`✅ Scale ${scale} textures loaded`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`   Scale ${scale} loading aborted (changed to scale ${this.currentScale})`);
            } else {
                console.error(`Texture loading failed for scale ${scale}:`, error);
            }
        } finally {
            // 현재 scale과 일치할 때만 정리
            if (this.currentScale === scale) {
                this.isLoading = false;
                this.loadingController = null;
            }
            this.hideLoader();
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
        // 정리 전 메모리 상태 기록
        const beforeMem = this.getMemoryInfo();
        
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
                            frames.forEach(textureData => {
                                if (textureData && textureData.texture) {
                                    try {
                                        // Three.js 텍스처인 경우 dispose 호출
                                        if (textureData.threeTexture) {
                                            // Three.js Texture 객체의 dispose 메서드 호출
                                            if (textureData.texture.dispose) {
                                                textureData.texture.dispose();
                                                deletedCount++;
                                            } else {
                                                console.warn('Texture has no dispose method:', textureData);
                                                failedCount++;
                                            }
                                        } else {
                                            // 일반 WebGL 텍스처인 경우
                                            gl.deleteTexture(textureData.texture);
                                            deletedCount++;
                                        }
                                    } catch (error) {
                                        console.error('Error disposing texture:', error);
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
        
        // 정리 후 메모리 상태 기록
        const afterMem = this.getMemoryInfo();
        
        if (failedCount > 0) {
            console.log(`🗑️ Cleared ${deletedCount} textures from GPU memory (${failedCount} skipped)`);
        } else {
            console.log(`🗑️ Cleared ${deletedCount} textures from GPU memory`);
        }
        
        // 메모리 변화량 출력
        if (beforeMem.jsHeapUsed && afterMem.jsHeapUsed) {
            const beforeHeap = parseFloat(beforeMem.jsHeapUsed);
            const afterHeap = parseFloat(afterMem.jsHeapUsed);
            const diff = (beforeHeap - afterHeap).toFixed(2);
            console.log(`   Memory freed: ~${diff} MB (JS Heap: ${afterMem.jsHeapUsed})`);
        }
        
        // Garbage Collection 트리거 (Chrome에서만 작동)
        if (window.gc) {
            window.gc();
            console.log('   Garbage collection triggered');
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
                        
                        // 진행 상황 로그 (100개마다 메모리 포함)
                        if (totalLoaded % 100 === 0) {
                            const memInfo = this.getMemoryInfo();
                            console.log(`   Loaded ${totalLoaded} textures... (Memory: ${memInfo.estimatedTextureMemory}, JS Heap: ${memInfo.jsHeapUsed || 'N/A'})`);
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
        
        // 최종 메모리 상태 출력
        this.logMemoryUsage(`(After loading ${species}/${lifeStage})`);
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
        
        // 투명 배경을 위해 clear를 호출하지 않거나, 
        // 필요한 경우에만 깊이 버퍼만 클리어
        // gl.clear(gl.DEPTH_BUFFER_BIT);
        
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
        
        // 메모리 모니터 중지
        this.stopMemoryMonitor();
        
        // 렌더링 루프 중지
        this.stopRenderLoop();
        
        // 모든 로딩 중단
        this.stopAllLoading();
        
        // 이전 로딩 Promise 대기
        if (this.currentLoadingPromise) {
            this.currentLoadingPromise.catch(() => {});
            this.currentLoadingPromise = null;
        }
        
        // 텍스처 정리
        this.clearAllTextures();
        
        // 텍스처 로더 정리
        if (this.textureLoader) {
            this.textureLoader.destroy();
        }
        
        console.log('✅ WebGLManager cleaned up');
    }
}