'use strict';

/**
 * KTX2 Worker - 다양한 파라미터 조합 시도
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
    
    const bytesPerPixel = 4;
    const sizeInBytes = width * height * bytesPerPixel;
    const ptr = Module._malloc(sizeInBytes);
    
    let success = false;
    
    // 다양한 파라미터 조합 시도
    const attempts = [
        // 7개: layer/face 제외
        () => ktx2File.transcodeImage(ptr, 0, 0, 0, 0, 13, hasAlpha ? 0 : 1),
        // 6개: layer/face 합침
        () => ktx2File.transcodeImage(ptr, 0, 0, 0, 13, hasAlpha ? 0 : 1),
        // 5개: 최소 파라미터
        () => ktx2File.transcodeImage(ptr, 0, 0, 0, 13),
        // 4개: 더 단순하게
        () => ktx2File.transcodeImage(ptr, 0, 0, 13),
        // 다른 포맷 시도
        () => ktx2File.transcodeImage(ptr, 0, 0, 0, 0, 11, hasAlpha ? 0 : 1), // RGB565
        () => ktx2File.transcodeImage(ptr, 0, 0, 0, 0, 12, hasAlpha ? 0 : 1), // RGBA4444
    ];
    
    for (let i = 0; i < attempts.length; i++) {
        try {
            success = attempts[i]();
            if (success) {
                console.log(`[KTX2] Success with attempt ${i + 1}`);
                break;
            }
        } catch (e) {
            console.log(`[KTX2] Attempt ${i + 1} failed:`, e.message);
        }
    }
    
    if (!success) {
        Module._free(ptr);
        ktx2File.close();
        ktx2File.delete();
        throw new Error('All transcoding attempts failed');
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
            
            // 실패 시 단색
            const size = 32;
            const fallback = new Uint8Array(size * size * 4);
            for (let i = 0; i < fallback.length; i += 4) {
                fallback[i] = 255;
                fallback[i + 1] = 100;
                fallback[i + 2] = 100;
                fallback[i + 3] = 255;
            }
            
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

console.log('[KTX2] Multi-attempt worker ready');