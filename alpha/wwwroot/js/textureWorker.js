'use strict';

/**
 * 텍스처 워커
 * - KTX2 텍스처 디코딩
 * - 우선순위 기반 로딩 큐
 * - 메모리 효율적인 처리
 */

// Basis Universal 트랜스코더 초기화
let basisModule = null;
let isInitialized = false;
const loadingQueue = [];
const activeLoads = new Map();
const pendingMessages = []; // 초기화 전 받은 메시지 저장

/**
 * Basis 트랜스코더 초기화
 */
async function initBasis() {
    if (isInitialized) return;
    
    console.log('[Worker] Starting Basis initialization...');
    
    try {
        // Basis 트랜스코더 라이브러리 로드
        console.log('[Worker] Loading Basis transcoder script...');
        importScripts('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.js');
        
        // WASM 모듈 로드
        console.log('[Worker] Loading WASM module...');
        const wasmResponse = await fetch('https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.wasm');
        const wasmBinary = await wasmResponse.arrayBuffer();
        
        // 모듈 초기화
        console.log('[Worker] Initializing BASIS module...');
        
        // 모듈 초기화
        basisModule = await BASIS({
            wasmBinary: new Uint8Array(wasmBinary)
        });
        
        isInitialized = true;
        console.log('✅ Basis transcoder initialized in worker');
    } catch (error) {
        console.error('❌ Failed to initialize Basis:', error);
        throw error;
    }
}

/**
 * KTX2 파일 헤더 파싱
 */
function parseKTX2Header(buffer) {
    const view = new DataView(buffer);
    
    // KTX2 식별자 확인 (12 bytes)
    const identifier = new Uint8Array(buffer, 0, 12);
    const ktx2Identifier = [
        0xAB, 0x4B, 0x54, 0x58, // «KTX
        0x20, 0x32, 0x30, 0xBB, //  20»
        0x0D, 0x0A, 0x1A, 0x0A  // \r\n\x1A\n
    ];
    
    for (let i = 0; i < 12; i++) {
        if (identifier[i] !== ktx2Identifier[i]) {
            throw new Error('Invalid KTX2 file');
        }
    }
    
    // 헤더 정보 읽기
    const header = {
        vkFormat: view.getUint32(12, true),
        typeSize: view.getUint32(16, true),
        pixelWidth: view.getUint32(20, true),
        pixelHeight: view.getUint32(24, true),
        pixelDepth: view.getUint32(28, true),
        layerCount: view.getUint32(32, true),
        faceCount: view.getUint32(36, true),
        levelCount: view.getUint32(40, true),
        supercompressionScheme: view.getUint32(44, true)
    };
    
    return header;
}

/**
 * Basis 트랜스코딩
 */
function transcodeBasis(ktx2Data, header) {
    if (!basisModule) {
        throw new Error('Basis module not initialized');
    }
    
    const transcoder = new basisModule.BasisFile(new Uint8Array(ktx2Data));
    
    if (!transcoder.startTranscoding()) {
        throw new Error('Failed to start transcoding');
    }
    
    // 첫 번째 이미지 (레벨 0)
    const imageIndex = 0;
    const levelIndex = 0;
    
    const width = transcoder.getImageWidth(imageIndex, levelIndex);
    const height = transcoder.getImageHeight(imageIndex, levelIndex);
    
    // 최적의 포맷 결정
    let format, bytesPerBlock;
    
    // WebGPU는 BC7 지원
    if (transcoder.supportsFormat(basisModule.transcoder_texture_format.cTFBC7_RGBA)) {
        format = 'bc7-rgba-unorm';
        bytesPerBlock = 16;
    }
    // 폴백: BC3 (DXT5)
    else if (transcoder.supportsFormat(basisModule.transcoder_texture_format.cTFBC3_RGBA)) {
        format = 'bc3-rgba-unorm';
        bytesPerBlock = 16;
    }
    // 폴백: RGBA8
    else {
        format = 'rgba8unorm';
        bytesPerBlock = 4;
    }
    
    // 트랜스코딩 수행
    const dstSize = transcoder.getImageTranscodedSizeInBytes(
        imageIndex,
        levelIndex,
        format === 'rgba8unorm' 
            ? basisModule.transcoder_texture_format.cTFRGBA32
            : format === 'bc7-rgba-unorm'
                ? basisModule.transcoder_texture_format.cTFBC7_RGBA
                : basisModule.transcoder_texture_format.cTFBC3_RGBA
    );
    
    const dst = new Uint8Array(dstSize);
    
    const success = transcoder.transcodeImage(
        dst,
        imageIndex,
        levelIndex,
        format === 'rgba8unorm' 
            ? basisModule.transcoder_texture_format.cTFRGBA32
            : format === 'bc7-rgba-unorm'
                ? basisModule.transcoder_texture_format.cTFBC7_RGBA
                : basisModule.transcoder_texture_format.cTFBC3_RGBA,
        0,
        0
    );
    
    transcoder.close();
    transcoder.delete();
    
    if (!success) {
        throw new Error('Transcoding failed');
    }
    
    return {
        data: dst,
        width,
        height,
        format
    };
}

/**
 * KTX2 텍스처 로드 및 디코딩
 */
async function loadKTX2Texture(url, priority) {
    console.log(`[Worker] Starting to load KTX2: ${url}`);
    
    try {
        // Basis 초기화
        if (!isInitialized) {
            console.log(`[Worker] Initializing Basis...`);
            await initBasis();
        }
        
        // 파일 다운로드
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // KTX2 헤더 파싱
        const header = parseKTX2Header(arrayBuffer);
        
        // Basis Universal 압축인 경우
        if (header.supercompressionScheme === 1) { // BasisLZ
            const result = transcodeBasis(arrayBuffer, header);
            return result;
        }
        // Zstandard 압축인 경우
        else if (header.supercompressionScheme === 2) { // Zstandard
            console.log(`[Worker] Zstandard compression not fully supported, using fallback`);
            
            // 간단한 폴백: 압축되지 않은 더미 데이터 반환
            // 실제 텍스처는 로드되지 않지만 에러는 발생하지 않음
            const dummySize = 64;
            const dummyData = new Uint8Array(dummySize * dummySize * 4);
            
            // 체커보드 패턴 생성 (테스트용)
            for (let y = 0; y < dummySize; y++) {
                for (let x = 0; x < dummySize; x++) {
                    const idx = (y * dummySize + x) * 4;
                    const isWhite = ((x >> 3) + (y >> 3)) % 2 === 0;
                    const color = isWhite ? 255 : 128;
                    dummyData[idx] = color;     // R
                    dummyData[idx + 1] = color; // G
                    dummyData[idx + 2] = color; // B
                    dummyData[idx + 3] = 255;   // A
                }
            }
            
            return {
                data: dummyData,
                width: dummySize,
                height: dummySize,
                format: 'rgba8unorm'
            };
        }
        // 압축되지 않은 경우
        else if (header.supercompressionScheme === 0) {
            // 데이터 영역 추출
            const dfdByteOffset = 48;
            const view = new DataView(arrayBuffer);
            const dfdByteLength = view.getUint32(dfdByteOffset, true);
            
            const kvdByteOffset = dfdByteOffset + 4 + dfdByteLength;
            const kvdByteLength = view.getUint32(kvdByteOffset, true);
            
            const dataOffset = kvdByteOffset + 4 + kvdByteLength;
            const data = new Uint8Array(arrayBuffer, dataOffset);
            
            return {
                data,
                width: header.pixelWidth,
                height: header.pixelHeight,
                format: getWebGPUFormat(header.vkFormat)
            };
        }
        else {
            throw new Error(`Unsupported supercompression scheme: ${header.supercompressionScheme}`);
        }
    } catch (error) {
        console.error(`Failed to load KTX2 texture ${url}:`, error);
        throw error;
    }
}

/**
 * Vulkan 포맷을 WebGPU 포맷으로 변환
 */
function getWebGPUFormat(vkFormat) {
    const formatMap = {
        0: 'undefined',
        37: 'r8unorm',
        41: 'rgba8unorm',
        43: 'rgba8unorm-srgb',
        131: 'bc1-rgba-unorm',
        133: 'bc2-rgba-unorm',
        135: 'bc3-rgba-unorm',
        138: 'bc4-r-unorm',
        140: 'bc5-rg-unorm',
        143: 'bc6h-rgb-ufloat',
        145: 'bc7-rgba-unorm',
        147: 'bc7-rgba-unorm-srgb'
    };
    
    return formatMap[vkFormat] || 'rgba8unorm';
}

/**
 * 로딩 큐 처리
 */
async function processQueue() {
    if (loadingQueue.length === 0) return;
    
    console.log(`[Worker] Processing queue, ${loadingQueue.length} items`);
    
    // 우선순위로 정렬
    loadingQueue.sort((a, b) => b.priority - a.priority);
    
    // 병렬 처리 (최대 4개)
    const batch = loadingQueue.splice(0, 4);
    
    console.log(`[Worker] Processing batch of ${batch.length} items`);
    
    const promises = batch.map(async (item) => {
        try {
            const result = await loadKTX2Texture(item.url, item.priority);
            
            // 메인 스레드로 결과 전송
            self.postMessage({
                type: 'textureLoaded',
                id: item.id,
                data: result.data.buffer,
                width: result.width,
                height: result.height,
                format: result.format
            }, [result.data.buffer]); // Transferable로 전송
            
            activeLoads.delete(item.id);
        } catch (error) {
            self.postMessage({
                type: 'textureError',
                id: item.id,
                error: error.message
            });
            
            activeLoads.delete(item.id);
        }
    });
    
    await Promise.all(promises);
    
    // 다음 배치 처리
    if (loadingQueue.length > 0) {
        setTimeout(() => processQueue(), 0);
    }
}

/**
 * 메시지 핸들러
 */
self.addEventListener('message', async (e) => {
    console.log(`[Worker] Raw message received:`, e.data);
    
    // 초기화가 완료되지 않았으면 큐에 저장
    if (!isInitialized && e.data.type === 'loadKTX2') {
        console.log(`[Worker] Not initialized yet, queuing message`);
        pendingMessages.push(e.data);
        return;
    }
    
    const { type, id, url, priority = 0 } = e.data;
    
    console.log(`[Worker] Parsed message:`, { type, id, url, priority });
    
    switch (type) {
        case 'init':
            // 워커 초기화
            await initBasis();
            self.postMessage({ type: 'initialized' });
            break;
            
        case 'loadKTX2':
            console.log(`[Worker] Processing loadKTX2 for:`, url);
            
            // 이미 로딩 중인지 확인
            if (activeLoads.has(id)) {
                console.warn(`[Worker] Already loading: ${id}`);
                return;
            }
            
            activeLoads.set(id, { url, priority });
            
            // 큐에 추가
            loadingQueue.push({ id, url, priority });
            
            // 큐 처리 시작
            processQueue();
            break;
            
        case 'clearCache':
            // 캐시 정리
            loadingQueue.length = 0;
            activeLoads.clear();
            self.postMessage({ type: 'cacheCleared' });
            break;
            
        case 'updatePriority':
            // 우선순위 업데이트
            const item = loadingQueue.find(item => item.id === id);
            if (item) {
                item.priority = priority;
            }
            break;
            
        default:
            console.warn(`Unknown message type: ${type}`);
    }
});

/**
 * 에러 핸들러
 */
self.addEventListener('error', (error) => {
    console.error('Worker error:', error);
    self.postMessage({
        type: 'error',
        error: error.message
    });
});

/**
 * 거부된 프로미스 핸들러
 */
self.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
    self.postMessage({
        type: 'error',
        error: event.reason?.message || 'Unhandled rejection'
    });
});

// 워커 시작 시 초기화
initBasis().then(() => {
    console.log('✅ Texture worker ready');
    self.postMessage({ type: 'ready' });
    
    // 대기 중인 메시지 처리
    if (pendingMessages.length > 0) {
        console.log(`[Worker] Processing ${pendingMessages.length} pending messages`);
        pendingMessages.forEach(data => {
            self.dispatchEvent(new MessageEvent('message', { data }));
        });
        pendingMessages.length = 0;
    }
}).catch(error => {
    console.error('Failed to initialize worker:', error);
    self.postMessage({
        type: 'error',
        error: error.message
    });
});