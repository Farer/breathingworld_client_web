'use strict';

/**
 * KTX2 Worker with Basis Universal Transcoder (PixiJS 방식)
 */

// Basis 트랜스코더 로드
importScripts('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.js');

let basisModule = null;
let isInitialized = false;

// Basis 초기화
async function initBasis() {
    if (isInitialized) return;
    
    console.log('[BasisWorker] Initializing Basis transcoder...');
    
    // WASM 모듈 로드
    const wasmBinary = await fetch('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.wasm')
        .then(r => r.arrayBuffer());
    
    // Basis 모듈 초기화
    basisModule = BASIS({
        wasmBinary: new Uint8Array(wasmBinary)
    });
    
    basisModule.initializeBasis();
    
    isInitialized = true;
    console.log('[BasisWorker] Basis transcoder initialized');
}

/**
 * KTX2 파일 로드 및 디코딩
 */
async function loadKTX2Texture(url, id) {
    try {
        console.log(`[BasisWorker] Loading: ${url}`);
        
        // Basis 초기화
        if (!isInitialized) {
            await initBasis();
        }
        
        // 파일 다운로드
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        console.log(`[BasisWorker] File size: ${uint8Array.length} bytes`);
        
        // KTX2 파일 객체 생성
        const ktx2File = new basisModule.KTX2File(uint8Array);
        
        if (!ktx2File.isValid()) {
            console.error('[BasisWorker] Invalid KTX2 file');
            ktx2File.close();
            ktx2File.delete();
            throw new Error('Invalid KTX2 file');
        }
        
        const width = ktx2File.getWidth();
        const height = ktx2File.getHeight();
        const levels = ktx2File.getLevels();
        const hasAlpha = ktx2File.getHasAlpha();
        const isUASTC = ktx2File.isUASTC();
        
        console.log(`[BasisWorker] Dimensions: ${width}x${height}, Levels: ${levels}, Alpha: ${hasAlpha}, UASTC: ${isUASTC}`);
        
        // 트랜스코딩 시작
        if (!ktx2File.startTranscoding()) {
            console.error('[BasisWorker] Failed to start transcoding');
            ktx2File.close();
            ktx2File.delete();
            throw new Error('Failed to start transcoding');
        }
        
        // RGBA32로 트랜스코딩 (PixiJS와 동일한 방식)
        const format = hasAlpha ? 
            basisModule.transcoder_texture_format.cTFRGBA32 : 
            basisModule.transcoder_texture_format.cTFRGB32;
        
        // 첫 번째 mip level (0)만 처리
        const level = 0;
        const layerIndex = 0;
        const faceIndex = 0;
        
        // 트랜스코딩된 이미지 크기 계산
        const dstSize = ktx2File.getImageTranscodedSizeInBytes(level, layerIndex, faceIndex, format);
        console.log(`[BasisWorker] Transcoded size: ${dstSize} bytes`);
        
        // 버퍼 할당
        const dstData = new Uint8Array(dstSize);
        
        // 트랜스코딩 실행
        const result = ktx2File.transcodeImage(dstData, level, layerIndex, faceIndex, format);
        
        if (!result) {
            console.error('[BasisWorker] Failed to transcode image');
            ktx2File.close();
            ktx2File.delete();
            throw new Error('Failed to transcode image');
        }
        
        // 정리
        ktx2File.close();
        ktx2File.delete();
        
        console.log(`[BasisWorker] Successfully transcoded to RGBA: ${dstData.length} bytes`);
        
        // WebGPU가 기대하는 형식으로 반환
        return {
            data: dstData,
            width: width,
            height: height,
            format: hasAlpha ? 'rgba8unorm' : 'rgba8unorm' // WebGPU는 rgb8 지원 안함
        };
        
    } catch (error) {
        console.error(`[BasisWorker] Error loading ${url}:`, error);
        
        // 폴백: 더미 텍스처
        const size = 64;
        const data = new Uint8Array(size * size * 4);
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 200;     // R
            data[i + 1] = 200; // G
            data[i + 2] = 200; // B
            data[i + 3] = 255; // A
        }
        
        return {
            data: data,
            width: size,
            height: size,
            format: 'rgba8unorm'
        };
    }
}

/**
 * 메시지 핸들러
 */
self.addEventListener('message', async (e) => {
    const { type, id, url } = e.data;
    
    if (type === 'loadKTX2') {
        try {
            const result = await loadKTX2Texture(url, id);
            
            // ArrayBuffer로 전송
            self.postMessage({
                type: 'textureLoaded',
                id: id,
                data: result.data.buffer,
                width: result.width,
                height: result.height,
                format: result.format
            }, [result.data.buffer]);
            
        } catch (error) {
            self.postMessage({
                type: 'textureError',
                id: id,
                error: error.message
            });
        }
    }
});

// 초기화
initBasis().then(() => {
    console.log('[BasisWorker] Ready');
    self.postMessage({ type: 'ready' });
}).catch(error => {
    console.error('[BasisWorker] Init failed:', error);
    self.postMessage({ type: 'error', error: error.message });
});