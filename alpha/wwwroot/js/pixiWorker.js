'use strict';

/**
 * PixiJS 정확한 구현 - @pixi/basis 패키지 사용
 */

// PixiJS가 사용하는 정확한 basis transcoder
importScripts('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.js');

let basisTranscoderPromise = null;
let basisTranscoder = null;

// Basis 초기화 (PixiJS 방식)
function getBasisTranscoder() {
    if (!basisTranscoderPromise) {
        basisTranscoderPromise = new Promise(async (resolve) => {
            // WASM 파일 로드
            const wasmBinary = await fetch('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.wasm')
                .then(res => res.arrayBuffer())
                .then(buffer => new Uint8Array(buffer));
            
            // Basis 모듈 생성
            const BasisModule = {
                wasmBinary,
                onRuntimeInitialized() {
                    basisTranscoder = this;
                    basisTranscoder.initializeBasis();
                    console.log('[PixiBasis] Initialized');
                    resolve(basisTranscoder);
                }
            };
            
            // BASIS 함수 실행
            BASIS(BasisModule);
        });
    }
    
    return basisTranscoderPromise;
}

// KTX2 파일 처리
async function processKTX2(buffer) {
    const transcoder = await getBasisTranscoder();
    const ktx2Data = new Uint8Array(buffer);
    
    console.log(`[PixiBasis] Processing ${ktx2Data.length} bytes`);
    
    // KTX2File 클래스 사용
    const ktx2File = new transcoder.KTX2File(ktx2Data);
    
    try {
        if (!ktx2File.isValid()) {
            throw new Error('Invalid KTX2 file');
        }
        
        const width = ktx2File.getWidth();
        const height = ktx2File.getHeight();
        const levels = ktx2File.getLevels();
        const hasAlpha = ktx2File.getHasAlpha();
        const isUASTC = ktx2File.isUASTC();
        
        console.log(`[PixiBasis] ${width}x${height}, levels: ${levels}, alpha: ${hasAlpha}, UASTC: ${isUASTC}`);
        
        // 트랜스코딩 시작
        if (!ktx2File.startTranscoding()) {
            throw new Error('Failed to start transcoding');
        }
        
        // RGBA32 포맷 (13)
        const basisFormat = 13; // cTFRGBA32
        
        // 트랜스코딩된 크기 가져오기
        // getImageTranscodedSizeInBytes(imageIndex, levelIndex, layerIndex, format)
        const transcodeSize = ktx2File.getImageTranscodedSizeInBytes(0, 0, 0, basisFormat);
        
        console.log(`[PixiBasis] Transcoding to RGBA32, size: ${transcodeSize} bytes`);
        
        // 출력 버퍼를 WASM 메모리에 할당
        const rgbaDataPtr = transcoder._malloc(transcodeSize);
        
        // 트랜스코드 실행 (8개 파라미터)
        const success = ktx2File.transcodeImage(
            rgbaDataPtr,  // dstBuffer (포인터)
            0,  // imageIndex
            0,  // levelIndex  
            0,  // layerIndex
            0,  // faceIndex
            basisFormat,  // format (13 = RGBA32)
            0,  // getAlphaForOpaqueFormats (0 = no)
            -1  // channel (-1 = all channels)
        );
        
        if (!success) {
            transcoder._free(rgbaDataPtr);
            throw new Error('Failed to transcode image');
        }
        
        console.log('[PixiBasis] Transcoding successful!');
        
        // 결과를 JavaScript 배열로 복사
        const rgbaData = new Uint8Array(transcodeSize);
        const heapView = new Uint8Array(transcoder.HEAPU8.buffer, rgbaDataPtr, transcodeSize);
        rgbaData.set(heapView);
        
        // 메모리 정리
        transcoder._free(rgbaDataPtr);
        
        return {
            data: rgbaData,
            width: width,
            height: height,
            format: 'rgba8unorm'
        };
        
    } finally {
        // KTX2File 정리
        ktx2File.close();
        ktx2File.delete();
    }
}

// 메시지 핸들러
self.addEventListener('message', async (event) => {
    const { type, id, url } = event.data;
    
    if (type === 'loadKTX2') {
        try {
            console.log(`[PixiBasis] Loading: ${url}`);
            
            // 파일 다운로드
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const buffer = await response.arrayBuffer();
            
            // KTX2 처리
            const result = await processKTX2(buffer);
            
            // 성공 응답
            self.postMessage({
                type: 'textureLoaded',
                id: id,
                data: result.data.buffer,
                width: result.width,
                height: result.height,
                format: result.format
            }, [result.data.buffer]);
            
        } catch (error) {
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            console.error('[PixiBasis] Error:', errorMsg);
            
            // 에러 텍스처 (핑크)
            const size = 32;
            const errorData = new Uint8Array(size * size * 4);
            
            for (let i = 0; i < errorData.length; i += 4) {
                errorData[i] = 255;     // R
                errorData[i + 1] = 0;   // G
                errorData[i + 2] = 255; // B  
                errorData[i + 3] = 255; // A
            }
            
            self.postMessage({
                type: 'textureLoaded',
                id: id,
                data: errorData.buffer,
                width: size,
                height: size,
                format: 'rgba8unorm',
                error: errorMsg  // 문자열로 변환된 에러 메시지
            }, [errorData.buffer]);
        }
    }
});

console.log('[PixiBasis] Worker initialized');