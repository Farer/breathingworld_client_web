'use strict';

/**
 * Google Basis Universal 공식 라이브러리
 */

importScripts('https://unpkg.com/basis-universal@1.0.1/transcoder/build/basis_transcoder.js');

let BasisModule = null;

async function initBasis() {
    if (BasisModule) return;
    
    const wasmResponse = await fetch('https://unpkg.com/basis-universal@1.0.1/transcoder/build/basis_transcoder.wasm');
    const wasmBinary = await wasmResponse.arrayBuffer();
    
    return new Promise((resolve) => {
        BASIS({
            wasmBinary: new Uint8Array(wasmBinary),
            onRuntimeInitialized: function() {
                BasisModule = this;
                BasisModule.initializeBasis();
                console.log('[GoogleBasis] Initialized');
                resolve();
            }
        });
    });
}

function decodeKTX2(data) {
    const ktx2File = new BasisModule.KTX2File(data);
    
    if (!ktx2File.isValid()) {
        ktx2File.close();
        ktx2File.delete();
        throw new Error('Invalid KTX2 file');
    }
    
    const width = ktx2File.getWidth();
    const height = ktx2File.getHeight();
    const hasAlpha = ktx2File.getHasAlpha();
    
    console.log(`[GoogleBasis] ${width}x${height}, alpha:${hasAlpha}`);
    
    if (!ktx2File.startTranscoding()) {
        ktx2File.close();
        ktx2File.delete();
        throw new Error('Failed to start transcoding');
    }
    
    const dstFormat = 13; // RGBA32
    const transcodeSize = width * height * 4;
    const ptr = BasisModule._malloc(transcodeSize);
    
    // -1을 unsigned로 변환: 0xFFFFFFFF
    const success = ktx2File.transcodeImage(
        ptr, 0, 0, 0, 0, dstFormat, 
        hasAlpha ? 0 : 1, 
        0xFFFFFFFF
    );
    
    if (!success) {
        BasisModule._free(ptr);
        ktx2File.close();
        ktx2File.delete();
        throw new Error('Transcoding failed');
    }
    
    const result = new Uint8Array(BasisModule.HEAPU8.buffer, ptr, transcodeSize);
    const output = new Uint8Array(result);
    
    BasisModule._free(ptr);
    ktx2File.close();
    ktx2File.delete();
    
    return { data: output, width, height };
}

self.addEventListener('message', async (e) => {
    const { type, id, url } = e.data;
    
    if (type === 'loadKTX2') {
        try {
            await initBasis();
            
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            const result = decodeKTX2(new Uint8Array(buffer));
            
            self.postMessage({
                type: 'textureLoaded',
                id: id,
                data: result.data.buffer,
                width: result.width,
                height: result.height,
                format: 'rgba8unorm'
            }, [result.data.buffer]);
            
        } catch (error) {
            console.error('[GoogleBasis] Error:', error);
            
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

console.log('[GoogleBasis] Worker ready');