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
            try {
                // WASM 파일 로드
                const wasmBinary = await fetch('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.wasm')
                    .then(res => res.arrayBuffer())
                    .then(buffer => new Uint8Array(buffer));
                
                console.log('[PixiBasis] WASM loaded:', wasmBinary.length, 'bytes');
                
                // Basis 모듈 생성
                const BasisModule = {
                    wasmBinary,
                    onRuntimeInitialized() {
                        basisTranscoder = this;
                        
                        // API 확인
                        console.log('[PixiBasis] Module initialized');
                        console.log('[PixiBasis] Has initializeBasis:', typeof this.initializeBasis === 'function');
                        console.log('[PixiBasis] Has KTX2File:', typeof this.KTX2File === 'function');
                        console.log('[PixiBasis] Has BasisFile:', typeof this.BasisFile === 'function');
                        
                        // 사용 가능한 모든 함수 리스트
                        const funcs = Object.keys(this).filter(k => typeof this[k] === 'function');
                        console.log('[PixiBasis] Available functions:', funcs.slice(0, 20));
                        
                        // initializeBasis 호출 (있는 경우)
                        if (typeof this.initializeBasis === 'function') {
                            this.initializeBasis();
                        }
                        
                        console.log('[PixiBasis] Initialized with functions:', 
                            Object.keys(this).filter(k => typeof this[k] === 'function').slice(0, 10));
                        resolve(basisTranscoder);
                    }
                };
                
                // BASIS 함수 실행
                BASIS(BasisModule);
            } catch (error) {
                console.error('[PixiBasis] Init error:', error);
                throw error;
            }
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
    let ktx2File;
    try {
        // KTX2File이 존재하는지 확인
        if (!transcoder.KTX2File) {
            console.error('[PixiBasis] KTX2File class not found!');
            console.log('[PixiBasis] Available classes:', Object.keys(transcoder).filter(k => k.includes('KTX') || k.includes('Basis')));
            
            // BasisFile 시도
            if (transcoder.BasisFile) {
                console.log('[PixiBasis] Trying BasisFile instead...');
                const basisFile = new transcoder.BasisFile(ktx2Data);
                
                if (basisFile.isValid()) {
                    // BasisFile로 처리
                    const width = basisFile.getImageWidth(0, 0);
                    const height = basisFile.getImageHeight(0, 0);
                    const hasAlpha = basisFile.getHasAlpha();
                    
                    if (!basisFile.startTranscoding()) {
                        basisFile.close();
                        basisFile.delete();
                        throw new Error('Failed to start BasisFile transcoding');
                    }
                    
                    const format = 13; // RGBA32
                    const dstSize = width * height * 4;
                    const dstPtr = transcoder._malloc(dstSize);
                    
                    const success = basisFile.transcodeImage(
                        dstPtr,
                        0, // imageIndex
                        0, // levelIndex
                        format,
                        0, // getAlphaForOpaqueFormats
                        0  // channel
                    );
                    
                    if (success) {
                        const rgbaData = new Uint8Array(dstSize);
                        rgbaData.set(new Uint8Array(transcoder.HEAPU8.buffer, dstPtr, dstSize));
                        transcoder._free(dstPtr);
                        basisFile.close();
                        basisFile.delete();
                        
                        return {
                            data: rgbaData,
                            width: width,
                            height: height,
                            format: 'rgba8unorm'
                        };
                    }
                    
                    transcoder._free(dstPtr);
                    basisFile.close();
                    basisFile.delete();
                }
            }
            
            throw new Error('No suitable transcoder class found');
        }
        
        ktx2File = new transcoder.KTX2File(ktx2Data);
    } catch (e) {
        console.error('[PixiBasis] Failed to create KTX2File:', e);
        throw new Error('Failed to create KTX2File: ' + e.message);
    }
    
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
        let transcodeSize;
        try {
            transcodeSize = ktx2File.getImageTranscodedSizeInBytes(0, 0, 0, basisFormat);
        } catch (e) {
            console.error('[PixiBasis] Failed to get transcode size:', e);
            throw new Error('Failed to get transcode size: ' + e.message);
        }
        
        console.log(`[PixiBasis] Transcoding to RGBA32, size: ${transcodeSize} bytes`);
        
        // 출력 버퍼를 WASM 메모리에 할당
        let rgbaDataPtr;
        try {
            rgbaDataPtr = transcoder._malloc(transcodeSize);
        } catch (e) {
            console.error('[PixiBasis] Failed to allocate memory:', e);
            throw new Error('Failed to allocate memory: ' + e.message);
        }
        
        // 트랜스코드 실행 - 8개 파라미터 필요, channel은 양수여야 함
        let success = false;
        
        // 시도 1: channel 0
        try {
            success = ktx2File.transcodeImage(
                rgbaDataPtr,  // dstBuffer (포인터)
                0,  // imageIndex
                0,  // levelIndex  
                0,  // layerIndex
                0,  // faceIndex
                basisFormat,  // format (13 = RGBA32)
                0,  // getAlphaForOpaqueFormats (0 = no)
                0   // channel (0 = first channel)
            );
            console.log('[PixiBasis] transcodeImage with channel 0, success:', success);
        } catch (e1) {
            console.log('[PixiBasis] Channel 0 failed, trying channel 1...');
            
            // 시도 2: channel 1
            try {
                success = ktx2File.transcodeImage(
                    rgbaDataPtr,
                    0, 0, 0, 0,
                    basisFormat,
                    1,  // getAlphaForOpaqueFormats = 1
                    0   // channel
                );
                console.log('[PixiBasis] transcodeImage with alpha=1, success:', success);
            } catch (e2) {
                transcoder._free(rgbaDataPtr);
                console.error('[PixiBasis] Both attempts failed');
                console.error('Error with channel 0:', e1);
                console.error('Error with alpha 1:', e2);
                throw new Error('transcodeImage failed');
            }
        }
        
        if (!success) {
            transcoder._free(rgbaDataPtr);
            throw new Error('Failed to transcode image (returned false)');
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
        if (ktx2File) {
            try {
                ktx2File.close();
                ktx2File.delete();
            } catch (e) {
                console.error('[PixiBasis] Failed to clean up KTX2File:', e);
            }
        }
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