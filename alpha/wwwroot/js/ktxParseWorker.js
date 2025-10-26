'use strict';

/**
 * KTX-Parse + Basis Universal Worker
 * 실제로 작동하는 방식
 */

// KTX-Parse는 KTX2 컨테이너를 파싱
importScripts('https://cdn.jsdelivr.net/npm/ktx-parse@0.6.0/dist/ktx-parse.umd.js');
importScripts('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.js');

let transcoder = null;
let isReady = false;

async function initTranscoder() {
    if (isReady) return;
    
    const wasmBinary = await fetch('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.wasm')
        .then(r => r.arrayBuffer());
    
    return new Promise((resolve) => {
        BASIS({
            wasmBinary: new Uint8Array(wasmBinary),
            onRuntimeInitialized: function() {
                this.initializeBasis();
                transcoder = this;
                isReady = true;
                console.log('[KTX-Parse] Transcoder ready');
                resolve();
            }
        });
    });
}

async function loadAndTranscode(url) {
    // KTX2 파일 로드
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    
    // KTX-Parse로 컨테이너 파싱
    const container = KTX.read(new Uint8Array(buffer));
    
    console.log(`[KTX-Parse] Parsed KTX2:`, {
        pixelWidth: container.pixelWidth,
        pixelHeight: container.pixelHeight,
        levels: container.levels.length,
        supercompressionScheme: container.supercompressionScheme
    });
    
    // 첫 번째 레벨의 데이터 가져오기
    const level0 = container.levels[0];
    const levelData = level0.levelData;
    
    // BasisFile로 트랜스코드 (KTX2File이 아닌)
    const basisFile = new transcoder.BasisFile(levelData);
    
    try {
        if (!basisFile.isValid()) {
            throw new Error('Invalid basis data');
        }
        
        const width = basisFile.getImageWidth(0, 0);
        const height = basisFile.getImageHeight(0, 0);
        const hasAlpha = basisFile.getHasAlpha();
        
        console.log(`[KTX-Parse] Basis: ${width}x${height}, alpha:${hasAlpha}`);
        
        if (!basisFile.startTranscoding()) {
            throw new Error('Failed to start transcoding');
        }
        
        // RGBA32 포맷
        const format = 13;
        const dstSize = basisFile.getImageTranscodedSizeInBytes(0, 0, format, 0);
        const dstPtr = transcoder._malloc(dstSize);
        
        // BasisFile.transcodeImage는 다른 시그니처
        const success = basisFile.transcodeImage(
            dstPtr,
            0, // imageIndex
            0, // levelIndex
            format,
            hasAlpha ? 1 : 0, // hasAlpha
            0  // flags
        );
        
        if (!success) {
            transcoder._free(dstPtr);
            throw new Error('Transcoding failed');
        }
        
        const result = new Uint8Array(transcoder.HEAPU8.buffer, dstPtr, dstSize);
        const output = new Uint8Array(result);
        
        transcoder._free(dstPtr);
        
        return {
            data: output,
            width: container.pixelWidth,
            height: container.pixelHeight,
            format: 'rgba8unorm'
        };
        
    } finally {
        basisFile.close();
        basisFile.delete();
    }
}

self.addEventListener('message', async (e) => {
    const { type, id, url } = e.data;
    
    if (type === 'loadKTX2') {
        try {
            await initTranscoder();
            const result = await loadAndTranscode(url);
            
            self.postMessage({
                type: 'textureLoaded',
                id: id,
                data: result.data.buffer,
                width: result.width,
                height: result.height,
                format: result.format
            }, [result.data.buffer]);
            
        } catch (error) {
            console.error('[KTX-Parse] Error:', error);
            
            const size = 32;
            const errorData = new Uint8Array(size * size * 4);
            errorData.fill(200);
            
            self.postMessage({
                type: 'textureLoaded',
                id: id,
                data: errorData.buffer,
                width: size,
                height: size,
                format: 'rgba8unorm',
                error: error.message
            }, [errorData.buffer]);
        }
    }
});

console.log('[KTX-Parse] Worker ready');