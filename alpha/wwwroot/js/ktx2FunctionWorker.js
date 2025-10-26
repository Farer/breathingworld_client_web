'use strict';

/**
 * KTX2 Worker - channel을 함수로 처리
 */

importScripts('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.js');

let Module = null;
let BASIS_INITIALIZED = false;

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
                console.log('[KTX2] Initialized');
                resolve();
            }
        });
    });
}

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
    
    console.log(`[KTX2] ${width}x${height}, alpha:${hasAlpha}`);
    
    if (!ktx2File.startTranscoding()) {
        ktx2File.close();
        ktx2File.delete();
        throw new Error('startTranscoding failed');
    }
    
    const format = 13; // RGBA32
    const transcodeSize = width * height * 4;
    const ptr = Module._malloc(transcodeSize);
    
    let success = false;
    
    // 다양한 함수 시도
    const callbacks = [
        () => -1,           // 함수가 -1 반환
        () => 0,            // 함수가 0 반환
        () => {},           // 빈 함수
        function() { return -1; },  // 일반 함수
        null,               // null (오버로드된 버전?)
    ];
    
    for (let i = 0; i < callbacks.length; i++) {
        try {
            const callback = callbacks[i];
            
            if (callback === null) {
                // 다른 오버로드 버전 시도 (예: 파라미터 순서 변경)
                success = ktx2File.transcodeImage(
                    ptr,          // dst
                    0,            // image
                    0,            // level
                    format,       // format을 4번째로
                    0,            // layer
                    0,            // face
                    hasAlpha ? 0 : 1,  // alpha
                    0             // flags?
                );
            } else {
                // 8번째 파라미터로 함수 전달
                success = ktx2File.transcodeImage(
                    ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, callback
                );
            }
            
            if (success) {
                console.log(`[KTX2] Success with callback ${i}`);
                break;
            }
        } catch (e) {
            console.log(`[KTX2] Attempt ${i} failed:`, e.message || e);
        }
    }
    
    // 여전히 실패하면 WASM 함수 직접 호출
    if (!success) {
        try {
            // _ktx2_transcodeImage 같은 C 함수가 있을 수 있음
            const ktx2Ptr = ktx2File.$$.ptr || ktx2File.__ptr || ktx2File.ptr;
            
            if (Module._ktx2_transcodeImage) {
                success = Module._ktx2_transcodeImage(
                    ktx2Ptr, ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, 0
                );
                console.log('[KTX2] Direct WASM call success:', success);
            }
        } catch (e) {
            console.log('[KTX2] Direct WASM call failed:', e);
        }
    }
    
    if (!success) {
        Module._free(ptr);
        ktx2File.close();
        ktx2File.delete();
        throw new Error('All attempts failed - channel expects a function!');
    }
    
    const result = new Uint8Array(Module.HEAPU8.buffer, ptr, transcodeSize);
    const output = new Uint8Array(result);
    
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

self.addEventListener('message', async (e) => {
    const { type, id, url } = e.data;
    
    if (type === 'loadKTX2') {
        try {
            if (!BASIS_INITIALIZED) await initBasis();
            
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
            for (let i = 0; i < fallback.length; i += 4) {
                fallback[i] = 255;
                fallback[i + 1] = 150;
                fallback[i + 2] = 150;
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

console.log('[KTX2] Worker ready - testing channel as function');