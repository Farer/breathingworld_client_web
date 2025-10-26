'use strict';

/**
 * KTX2 Worker - 8번째 파라미터는 flags
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
                console.log('[KTX2] Initialized successfully!');
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
    
    // 8번째 파라미터는 flags입니다!
    // 0 = 기본 품질
    // cDecodeFlagsHighQuality 등의 플래그 사용 가능
    const flags = 0; // 기본 플래그
    
    const success = ktx2File.transcodeImage(
        ptr,        // dst pointer
        0,          // image index  
        0,          // level index
        0,          // layer index
        0,          // face index
        format,     // format (13 = RGBA32)
        hasAlpha ? 0 : 1,  // get_alpha_for_opaque_formats
        flags       // decode flags (NOT channel!)
    );
    
    if (!success) {
        Module._free(ptr);
        ktx2File.close();
        ktx2File.delete();
        throw new Error('Transcoding failed');
    }
    
    console.log('[KTX2] Transcoding successful!');
    
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
            
            // 에러 시 회색 텍스처
            const size = 32;
            const fallback = new Uint8Array(size * size * 4);
            for (let i = 0; i < fallback.length; i += 4) {
                fallback[i] = 128;
                fallback[i + 1] = 128;
                fallback[i + 2] = 128;
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

console.log('[KTX2] Worker ready - flags parameter corrected!');