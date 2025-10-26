'use strict';

/**
 * KTX2 Worker - Emscripten embind 객체 시도
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
                
                // Emscripten 객체 확인
                console.log('[KTX2] Has emscripten_val:', typeof Module.emscripten_val);
                console.log('[KTX2] Has embind:', typeof Module.embind);
                console.log('[KTX2] Module keys with val:', Object.keys(Module).filter(k => k.includes('val')).slice(0, 10));
                
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
    
    // Emscripten embind 객체 시도
    try {
        // embind로 래핑된 값 생성
        const channelObj = {
            value: -1,
            valueOf: () => -1,
            toString: () => '-1'
        };
        
        success = ktx2File.transcodeImage(
            ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, channelObj
        );
        
        if (success) {
            console.log('[KTX2] Success with channel object');
        }
    } catch (e) {
        console.log('[KTX2] Object channel failed:', e.message);
    }
    
    // Emscripten val 시도
    if (!success && Module.emscripten_val_new) {
        try {
            const val = Module.emscripten_val_new(-1);
            success = ktx2File.transcodeImage(
                ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, val
            );
            if (success) {
                console.log('[KTX2] Success with emscripten_val');
            }
        } catch (e) {
            console.log('[KTX2] emscripten_val failed:', e.message);
        }
    }
    
    // 빈 객체 시도
    if (!success) {
        try {
            success = ktx2File.transcodeImage(
                ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, {}
            );
            if (success) {
                console.log('[KTX2] Success with empty object');
            }
        } catch (e) {
            console.log('[KTX2] Empty object failed:', e.message);
        }
    }
    
    // 배열 시도
    if (!success) {
        try {
            success = ktx2File.transcodeImage(
                ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, []
            );
            if (success) {
                console.log('[KTX2] Success with array');
            }
        } catch (e) {
            console.log('[KTX2] Array failed:', e.message);
        }
    }
    
    // Module 객체 자체 시도
    if (!success) {
        try {
            success = ktx2File.transcodeImage(
                ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, Module
            );
            if (success) {
                console.log('[KTX2] Success with Module object');
            }
        } catch (e) {
            console.log('[KTX2] Module object failed:', e.message);
        }
    }
    
    // ktx2File 자체 시도 (self reference?)
    if (!success) {
        try {
            success = ktx2File.transcodeImage(
                ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, ktx2File
            );
            if (success) {
                console.log('[KTX2] Success with self reference');
            }
        } catch (e) {
            console.log('[KTX2] Self reference failed:', e.message);
        }
    }
    
    if (!success) {
        Module._free(ptr);
        ktx2File.close();
        ktx2File.delete();
        throw new Error('All embind attempts failed');
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
                fallback[i] = 180;
                fallback[i + 1] = 180;
                fallback[i + 2] = 200;
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

console.log('[KTX2] Worker ready - testing embind objects');