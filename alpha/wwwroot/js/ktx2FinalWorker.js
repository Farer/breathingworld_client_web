'use strict';

/**
 * KTX2 Worker - PixiJS basis, 올바른 파라미터 찾기
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
                
                // Transcoder API 확인
                console.log('[KTX2] Module functions:', Object.keys(Module).filter(k => k.includes('transcode')).slice(0, 10));
                console.log('[KTX2] Format enum:', Module.transcoder_texture_format);
                
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
    const isUASTC = ktx2File.isUASTC();
    
    console.log(`[KTX2] ${width}x${height}, alpha:${hasAlpha}, UASTC:${isUASTC}`);
    
    // KTX2File의 메서드 확인
    console.log('[KTX2] KTX2File methods:', Object.keys(Object.getPrototypeOf(ktx2File)).filter(k => k.includes('transcode')));
    
    if (!ktx2File.startTranscoding()) {
        ktx2File.close();
        ktx2File.delete();
        throw new Error('startTranscoding failed');
    }
    
    const format = 13; // RGBA32
    const transcodeSize = width * height * 4;
    const ptr = Module._malloc(transcodeSize);
    
    let success = false;
    
    // 다양한 channel 값 시도
    const channelValues = [
        -1,           // 원래 의도
        0,            // 첫 번째 채널
        0xFFFFFFFF,   // unsigned -1
        255,          // 8비트 최대
        65535,        // 16비트 최대
        null,         // null
        undefined     // undefined
    ];
    
    for (let i = 0; i < channelValues.length; i++) {
        try {
            const channel = channelValues[i];
            
            // null/undefined인 경우 파라미터 개수 조정
            if (channel === null || channel === undefined) {
                success = ktx2File.transcodeImage(
                    ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1
                );
            } else {
                success = ktx2File.transcodeImage(
                    ptr, 0, 0, 0, 0, format, hasAlpha ? 0 : 1, channel
                );
            }
            
            if (success) {
                console.log(`[KTX2] Success with channel value: ${channel}`);
                break;
            }
        } catch (e) {
            console.log(`[KTX2] Channel ${channelValues[i]} failed:`, e.message || e);
        }
    }
    
    // 여전히 실패하면 다른 API 시도
    if (!success) {
        try {
            // getImageTranscodedSizeInBytes가 작동했으므로 비슷한 API가 있을 수 있음
            const size = ktx2File.getImageTranscodedSizeInBytes(0, 0, 0, format);
            console.log(`[KTX2] Transcode size from API: ${size}`);
            
            // 다른 메서드 이름 시도
            if (ktx2File.transcodeImageLevel) {
                success = ktx2File.transcodeImageLevel(ptr, 0, 0, format, hasAlpha ? 0 : 1);
            } else if (ktx2File.transcodeImageData) {
                success = ktx2File.transcodeImageData(ptr, 0, 0, format);
            }
        } catch (e) {
            console.log('[KTX2] Alternative API failed:', e);
        }
    }
    
    if (!success) {
        Module._free(ptr);
        ktx2File.close();
        ktx2File.delete();
        throw new Error('All transcoding attempts failed');
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
                fallback[i] = 200;
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

console.log('[KTX2] Worker ready');