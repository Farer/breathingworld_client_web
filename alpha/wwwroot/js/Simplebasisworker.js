'use strict';

/**
 * Simplified KTX2 Worker using Basis Universal
 * Based on PixiJS implementation
 */

// Basis transcoder 로드
self.BASIS = null;
let basisInitialized = false;

// Basis 초기화
async function initializeBasis() {
    if (basisInitialized) return;

    console.log('[SimpleBasis] Loading Basis transcoder...');
    
    // JS와 WASM 로드
    importScripts('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.js');
    
    const wasmBinary = await fetch('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.wasm')
        .then(r => r.arrayBuffer())
        .then(buffer => new Uint8Array(buffer));

    // Basis 모듈 초기화
    return new Promise((resolve) => {
        self.BASIS = BASIS({
            wasmBinary,
            onRuntimeInitialized() {
                console.log('[SimpleBasis] Basis initialized');
                basisInitialized = true;
                resolve();
            }
        });
    });
}

// KTX2 디코딩
async function decodeKTX2(arrayBuffer) {
    if (!basisInitialized) {
        await initializeBasis();
    }
    
    const data = new Uint8Array(arrayBuffer);
    
    // KTX2 파일 생성
    const ktx2File = new self.BASIS.KTX2File(data);
    
    if (!ktx2File.isValid()) {
        ktx2File.close();
        ktx2File.delete();
        throw new Error('Invalid KTX2 file');
    }
    
    const width = ktx2File.getWidth();
    const height = ktx2File.getHeight();
    const hasAlpha = ktx2File.getHasAlpha();
    
    console.log(`[SimpleBasis] KTX2: ${width}x${height}, alpha: ${hasAlpha}`);
    
    // 트랜스코딩 시작
    if (!ktx2File.startTranscoding()) {
        ktx2File.close();
        ktx2File.delete();
        throw new Error('Failed to start transcoding');
    }
    
    // RGBA32로 변환 (WebGPU용)
    const format = self.BASIS.transcoder_texture_format.cTFRGBA32;
    
    // 출력 버퍼 크기 계산
    const transcodeSize = ktx2File.getImageTranscodedSizeInBytes(0, 0, 0, format);
    const buffer = new Uint8Array(transcodeSize);
    
    // 트랜스코딩
    if (!ktx2File.transcodeImage(buffer, 0, 0, 0, format)) {
        ktx2File.close();
        ktx2File.delete();
        throw new Error('Failed to transcode image');
    }
    
    // 정리
    ktx2File.close();
    ktx2File.delete();
    
    return {
        data: buffer,
        width,
        height,
        format: 'rgba8unorm'
    };
}

// 메시지 처리
self.addEventListener('message', async (event) => {
    const { type, id, url } = event.data;
    
    if (type === 'loadKTX2') {
        try {
            // 초기화
            if (!basisInitialized) {
                await initializeBasis();
            }
            
            // 파일 로드
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            // 디코딩
            const result = await decodeKTX2(arrayBuffer);
            
            // 결과 전송
            self.postMessage({
                type: 'textureLoaded',
                id,
                data: result.data.buffer,
                width: result.width,
                height: result.height,
                format: result.format
            }, [result.data.buffer]);
            
        } catch (error) {
            console.error('[SimpleBasis] Error:', error);
            
            // 폴백 텍스처
            const size = 64;
            const fallback = new Uint8Array(size * size * 4);
            for (let i = 0; i < fallback.length; i += 4) {
                fallback[i] = 255;     // R
                fallback[i + 1] = 0;   // G
                fallback[i + 2] = 255; // B
                fallback[i + 3] = 255; // A
            }
            
            self.postMessage({
                type: 'textureLoaded',
                id,
                data: fallback.buffer,
                width: size,
                height: size,
                format: 'rgba8unorm',
                error: error.message
            }, [fallback.buffer]);
        }
    }
});

console.log('[SimpleBasis] Worker ready');