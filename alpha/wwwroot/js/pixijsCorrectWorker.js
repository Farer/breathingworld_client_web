'use strict';

/**
 * PixiJS의 정확한 BasisFile API 사용
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
                console.log('[PixiJS] Basis initialized');
                resolve();
            }
        });
    });
}

function decodeKTX2(data) {
    // BasisFile을 사용! (KTX2File이 아닌)
    const basisFile = new Module.BasisFile(data);
    
    try {
        const images = basisFile.getNumImages();
        const levels = basisFile.getNumLevels(0);
        
        // 첫 번째 이미지의 크기
        const width = basisFile.getImageWidth(0, 0);
        const height = basisFile.getImageHeight(0, 0);
        
        console.log(`[PixiJS] ${width}x${height}, images:${images}, levels:${levels}`);
        
        if (!basisFile.startTranscoding()) {
            throw new Error('startTranscoding failed');
        }
        
        const format = 13; // RGBA32
        const imageIndex = 0;
        const levelIndex = 0;
        
        // 트랜스코드된 크기
        const transcodeSize = basisFile.getImageTranscodedSizeInBytes(
            imageIndex,
            levelIndex,
            format
        );
        
        // Uint8Array 버퍼 생성 (포인터가 아님!)
        const levelBuffer = new Uint8Array(transcodeSize);
        
        // PixiJS의 정확한 파라미터 순서
        const success = basisFile.transcodeImage(
            levelBuffer,        // buffer: Uint8Array
            imageIndex,         // imageIndex: 0
            levelIndex,         // levelIndex: 0
            format,            // format: 13 (RGBA32)
            1,                 // unused: 1
            0                  // getAlphaForOpaqueFormats: 0
        );
        
        if (!success) {
            throw new Error('transcodeImage failed');
        }
        
        console.log('[PixiJS] Transcoding successful!');
        
        return {
            data: levelBuffer,
            width: width,
            height: height,
            format: 'rgba8unorm'
        };
        
    } finally {
        // BasisFile은 close/delete 메서드가 없을 수 있음
        if (basisFile.close) basisFile.close();
        if (basisFile.delete) basisFile.delete();
    }
}

self.addEventListener('message', async (e) => {
    const { type, id, url } = e.data;
    
    if (type === 'loadKTX2') {
        try {
            await initBasis();
            
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
            console.error('[PixiJS] Error:', error);
            
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

console.log('[PixiJS] Worker ready with correct API');