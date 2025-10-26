'use strict';

/**
 * KTX2 Worker - format 확인 후 올바른 파라미터 사용
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
    
    // getImageTranscodedSizeInBytes를 사용해서 정확한 크기 계산
    const format = 13; // RGBA32
    const transcodeSize = ktx2File.getImageTranscodedSizeInBytes(0, 0, 0, format);
    
    console.log(`[KTX2] Transcode size: ${transcodeSize} bytes for format ${format}`);
    
    const ptr = Module._malloc(transcodeSize);
    
    // 8개 파라미터, 마지막은 -1이 아닌 다른 값 시도
    let success = false;
    const attempts = [
        [ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, 0],  // channel = 0
        [ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, 1],  // channel = 1
        [ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, 2],  // channel = 2
        [ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, 3],  // channel = 3
        [ptr, 0, 0, 0, 0, format, 0, 0],  // no alpha
        [ptr, 0, 0, 0, 0, format, 1, 0],  // force alpha
    ];
    
    for (let i = 0; i < attempts.length; i++) {
        try {
            success = ktx2File.transcodeImage(...attempts[i]);
            if (success) {
                console.log(`[KTX2] Success with params:`, attempts[i].slice(1));
                break;
            }
        } catch (e) {
            console.log(`[KTX2] Attempt ${i + 1} error:`, e.message || e);
        }
    }
    
    if (!success) {
        // 마지막 시도: transcodeImage 대신 다른 메서드가 있는지 확인
        console.log('[KTX2] Available methods:', Object.keys(ktx2File).filter(k => k.includes('transcode')));
        
        Module._free(ptr);
        ktx2File.close();
        ktx2File.delete();
        throw new Error('All attempts failed');
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
            for (let i = 0; i < fallback.length; i += 4) {
                fallback[i] = 200;
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

console.log('[KTX2] Worker ready');