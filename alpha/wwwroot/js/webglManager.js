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
    
    // ✅ 동물 프레임 로드
    async loadAnimalFrames(species, lifeStage, scale) {
        console.log(`📦 Loading ${species} ${lifeStage} frames at scale ${scale}...`);
        
        const basePath = `/img/ktx2/${species}/${lifeStage}/${scale}`;
        const animations = ['idle_1', 'walk_1', 'run_1'];
        
        this.textures[species][lifeStage] = this.textures[species][lifeStage] || {};
        
        for (const anim of animations) {
            const url = `${basePath}/${anim}/direction_00/frame_0000.ktx2`;
            
            try {
                // ✅ Three.js KTX2Loader 사용
                const data = await this.textureLoader.loadKTX2(url);
                
                console.log(`   ✅ Loaded: ${url} (${data.width}x${data.height})`);
                
                if (!this.textures[species][lifeStage][anim]) {
                    this.textures[species][lifeStage][anim] = {};
                }
                this.textures[species][lifeStage][anim]['direction_00'] = [data.texture];
                
            } catch (error) {
                console.warn(`   ⚠️ Failed to load ${url}:`, error.message);
            }
        }
        
        console.log(`✅ ${species} ${lifeStage} frames loaded`);
    }
    
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
        
        // 텍스처 로더 정리
        if (this.textureLoader) {
            this.textureLoader.destroy();
        }
        
        // 텍스처 정리
        const gl = this.gl;
        for (const category in this.textures) {
            // TODO: 텍스처 삭제
        }
        
        console.log('✅ WebGLManager cleaned up');
    }
}