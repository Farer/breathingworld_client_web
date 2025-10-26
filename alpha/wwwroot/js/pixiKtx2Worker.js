'use strict';

/**
 * PixiJS의 KTX2 파서 로직을 Worker에서 구현
 * PixiJS가 실제로 사용하는 방식을 따라함
 */

importScripts('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.js');

let transcoder = null;
let isReady = false;

// PixiJS가 사용하는 초기화 방식
async function initTranscoder() {
    if (isReady) return;
    
    const wasmBinary = await fetch('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.wasm')
        .then(r => r.arrayBuffer());
    
    return new Promise((resolve) => {
        BASIS({
            wasmBinary: new Uint8Array(wasmBinary),
            onRuntimeInitialized: function() {
                const { BasisFile, KTX2File, initializeBasis } = this;
                
                // PixiJS 방식의 초기화
                initializeBasis();
                
                transcoder = {
                    BasisFile: BasisFile,
                    KTX2File: KTX2File,
                    Module: this
                };
                
                isReady = true;
                console.log('[PixiKTX2] Transcoder ready');
                resolve();
            }
        });
    });
}

// PixiJS의 KTX2 디코딩 로직
function transcodeKTX2(arrayBuffer) {
    if (!transcoder) throw new Error('Transcoder not initialized');
    
    const data = new Uint8Array(arrayBuffer);
    const ktx2 = new transcoder.KTX2File(data);
    
    try {
        if (!ktx2.isValid()) {
            throw new Error('Invalid KTX2 file');
        }
        
        const width = ktx2.getWidth();
        const height = ktx2.getHeight();
        const levels = ktx2.getLevels();
        const hasAlpha = ktx2.getHasAlpha();
        const isUASTC = ktx2.isUASTC();
        
        console.log(`[PixiKTX2] ${width}x${height}, levels:${levels}, alpha:${hasAlpha}, UASTC:${isUASTC}`);
        
        if (!ktx2.startTranscoding()) {
            throw new Error('Failed to start transcoding');
        }
        
        // PixiJS는 RGBA32를 기본으로 사용
        const basisFormat = 13; // cTFRGBA32
        
        // 첫 번째 이미지, 첫 번째 레벨
        const imageIndex = 0;
        const levelIndex = 0;
        const layerIndex = 0;
        const faceIndex = 0;
        
        // 트랜스코드된 크기 가져오기
        const dstSize = ktx2.getImageTranscodedSizeInBytes(
            imageIndex,
            levelIndex, 
            layerIndex,
            basisFormat
        );
        
        // 메모리 할당
        const dst = new Uint8Array(dstSize);
        const dstPtr = transcoder.Module._malloc(dstSize);
        
        // PixiJS가 사용하는 실제 transcodeImage 호출
        // PixiJS 소스를 보면 파라미터 구성이 다를 수 있음
        let success = false;
        
        // 8개 파라미터 - 여러 조합 시도
        const attempts = [
            // 시도 1: channel/flags = 0
            [dstPtr, imageIndex, levelIndex, layerIndex, faceIndex, basisFormat, hasAlpha ? 0 : 1, 0],
            // 시도 2: channel/flags = null wrapper
            [dstPtr, imageIndex, levelIndex, layerIndex, faceIndex, basisFormat, hasAlpha ? 0 : 1, { value: 0 }],
            // 시도 3: getAlpha 반대
            [dstPtr, imageIndex, levelIndex, layerIndex, faceIndex, basisFormat, hasAlpha ? 1 : 0, 0],
            // 시도 4: 마지막 파라미터 생략 (undefined)
            [dstPtr, imageIndex, levelIndex, layerIndex, faceIndex, basisFormat, hasAlpha ? 0 : 1, undefined],
        ];
        
        for (let i = 0; i < attempts.length; i++) {
            try {
                success = ktx2.transcodeImage(...attempts[i]);
                
                if (success) {
                    console.log(`[PixiKTX2] Success with attempt ${i + 1}:`, attempts[i].slice(1));
                    break;
                }
            } catch (e) {
                console.log(`[PixiKTX2] Attempt ${i + 1} failed:`, e.message);
            }
        }
        
        if (!success) {
            transcoder.Module._free(dstPtr);
            throw new Error('Transcoding failed');
        }
        
        // 결과 복사
        dst.set(new Uint8Array(transcoder.Module.HEAPU8.buffer, dstPtr, dstSize));
        transcoder.Module._free(dstPtr);
        
        return {
            data: dst,
            width: width,
            height: height,
            format: 'rgba8unorm'
        };
        
    } finally {
        ktx2.close();
        ktx2.delete();
    }
}

// Worker 메시지 핸들러
self.addEventListener('message', async (e) => {
    const { type, id, url } = e.data;
    
    if (type === 'loadKTX2') {
        try {
            // 트랜스코더 초기화
            await initTranscoder();
            
            // KTX2 파일 로드
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            // 트랜스코드
            const result = transcodeKTX2(arrayBuffer);
            
            // 결과 전송
            self.postMessage({
                type: 'textureLoaded',
                id: id,
                data: result.data.buffer,
                width: result.width,
                height: result.height,
                format: result.format
            }, [result.data.buffer]);
            
        } catch (error) {
            console.error('[PixiKTX2] Error:', error);
            
            // 에러 텍스처
            const size = 32;
            const errorData = new Uint8Array(size * size * 4);
            for (let i = 0; i < errorData.length; i += 4) {
                errorData[i] = 255;
                errorData[i + 1] = 100;
                errorData[i + 2] = 100;
                errorData[i + 3] = 255;
            }
            
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

console.log('[PixiKTX2] Worker initialized - Using PixiJS approach');