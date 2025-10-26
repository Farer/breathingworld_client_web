'use strict';

/**
 * KTX2 Worker - PixiJS 정확한 구현
 * pixi-basis-ktx2 라이브러리의 실제 사용법
 */

importScripts('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.js');

let Module = null;
let BASIS_INITIALIZED = false;

// Basis 초기화
async function initBasis() {
    if (BASIS_INITIALIZED) return;
    
    const wasmBinary = await fetch('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.wasm')
        .then(r => r.arrayBuffer());
    
    return new Promise((resolve) => {
        BASIS({
            wasmBinary: new Uint8Array(wasmBinary),
            onRuntimeInitialized: function() {
                Module = this;
                Module.initializeBasis();
                BASIS_INITIALIZED = true;
                console.log('[KTX2] Basis initialized');
                resolve();
            }
        });
    });
}

// KTX2 디코딩
function decodeKTX2(data) {
    const ktx2File = new Module.KTX2File(data);
    
    if (!ktx2File.isValid()) {
        ktx2File.close();
        ktx2File.delete();
        throw new Error('Invalid KTX2');
    }
    
    const width = ktx2File.getWidth();
    const height = ktx2File.getHeight();
    const hasAlpha = ktx2File.getHasAlpha();
    const isUASTC = ktx2File.isUASTC();
    
    console.log(`[KTX2] ${width}x${height}, alpha:${hasAlpha}, UASTC:${isUASTC}`);
    
    if (!ktx2File.startTranscoding()) {
        ktx2File.close();
        ktx2File.delete();
        throw new Error('startTranscoding failed');
    }
    
    // 포맷 결정 - 숫자로 직접 지정
    const dstFormat = 13; // cTFRGBA32 = 13
    
    // 크기 계산
    const bytesPerPixel = 4;
    const sizeInBytes = width * height * bytesPerPixel;
    
    // 메모리 할당
    const ptr = Module._malloc(sizeInBytes);
    
    // 트랜스코딩 - 8개 파라미터
    const success = ktx2File.transcodeImage(
        ptr,        // dst pointer
        0,          // image index  
        0,          // level index
        0,          // layer index
        0,          // face index
        dstFormat,  // format (13 = RGBA32)
        hasAlpha ? 0 : 1,  // get_alpha_for_opaque_formats
        0           // channel0
    );
    
    if (!success) {
        Module._free(ptr);
        ktx2File.close();
        ktx2File.delete();
        throw new Error('transcodeImage failed');
    }
    
    // 결과 복사
    const result = new Uint8Array(Module.HEAPU8.buffer, ptr, sizeInBytes);
    const output = new Uint8Array(result);
    
    // 정리
    Module._free(ptr);
    ktx2File.close();
    ktx2File.delete();
    
    return {
        data: output,
        width: width,
        height: height,
        format: 'rgba8unorm'
    };
}

// 메시지 핸들러
self.addEventListener('message', async (e) => {
    const { type, id, url } = e.data;
    
    if (type === 'loadKTX2') {
        try {
            if (!BASIS_INITIALIZED) {
                await initBasis();
            }
            
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            const data = new Uint8Array(buffer);
            
            const result = decodeKTX2(data);
            
            self.postMessage({
                type: 'textureLoaded',
                id: id,
                data: result.data.buffer,
                width: result.width,
                height: result.height,
                format: result.format
            }, [result.data.buffer]);
            
        } catch (error) {
            console.error('[KTX2] Error:', error);
            
            const size = 32;
            const fallback = new Uint8Array(size * size * 4);
            fallback.fill(200);
            
            self.postMessage({
                type: 'textureLoaded',
                id: id,
                data: fallback.buffer,
                width: size,
                height: size,
                format: 'rgba8unorm',
                error: error.message
            }, [fallback.buffer]);
        }
    }
});

console.log('[KTX2] Worker ready');