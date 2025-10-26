'use strict';

/**
 * KTX2 텍스처 워커 - Zstandard 지원
 */

console.log('[KTX2Worker] Initializing...');

// 전역 변수
let isInitialized = false;
const pendingMessages = [];

// Zstandard 디코더 로드
async function initZstd() {
    if (isInitialized) return;
    
    try {
        console.log('[KTX2Worker] Loading Zstandard decoder...');
        importScripts('https://cdn.jsdelivr.net/npm/fzstd@0.1.1/umd/index.js');
        isInitialized = true;
        console.log('[KTX2Worker] Zstandard decoder ready');
        
        // 대기 중인 메시지 처리
        while (pendingMessages.length > 0) {
            const msg = pendingMessages.shift();
            handleMessage(msg);
        }
    } catch (error) {
        console.error('[KTX2Worker] Failed to initialize:', error);
        throw error;
    }
}

/**
 * KTX2 헤더 파싱
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
 * KTX2 텍스처 로드 및 디코딩
 */
async function loadKTX2Texture(url, id) {
    try {
        // console.log(`[KTX2Worker] Loading: ${url}`);
        
        // 파일 다운로드
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        // console.log(`[KTX2Worker] File size: ${arrayBuffer.byteLength} bytes`);
        
        const header = parseKTX2Header(arrayBuffer);
        // console.log(`[KTX2Worker] Size: ${header.pixelWidth}x${header.pixelHeight}, Format: ${header.vkFormat}, Compression: ${header.supercompressionScheme}`);
        
        // Zstandard 압축인 경우
        if (header.supercompressionScheme === 2) {
            const bytes = new Uint8Array(arrayBuffer);
            
            // Zstandard 매직 넘버 찾기: 0x28, 0xB5, 0x2F, 0xFD
            let zstdStart = -1;
            for (let i = 48; i < bytes.length - 4; i++) {
                if (bytes[i] === 0x28 && bytes[i+1] === 0xB5 && 
                    bytes[i+2] === 0x2F && bytes[i+3] === 0xFD) {
                    zstdStart = i;
                    // console.log(`[KTX2Worker] Found Zstandard magic at offset ${i}`);
                    break;
                }
            }
            
            if (zstdStart === -1) {
                // 대체 매직 넘버들 시도 (little endian)
                for (let i = 48; i < bytes.length - 4; i++) {
                    if (bytes[i] === 0xFD && bytes[i+1] === 0x2F && 
                        bytes[i+2] === 0xB5 && bytes[i+3] === 0x28) {
                        zstdStart = i;
                        console.log(`[KTX2Worker] Found Zstandard magic (LE) at offset ${i}`);
                        break;
                    }
                }
            }
            
            if (zstdStart === -1) {
                console.log(`[KTX2Worker] No Zstandard magic found, scanning for patterns...`);
                
                // 헤더 이후 첫 100 바이트 출력해서 패턴 확인
                let hexDump = '';
                for (let i = 48; i < Math.min(148, bytes.length); i++) {
                    hexDump += bytes[i].toString(16).padStart(2, '0') + ' ';
                    if ((i - 48) % 16 === 15) hexDump += '\n';
                }
                console.log(`[KTX2Worker] Hex dump from offset 48:\n${hexDump}`);
                
                // Level Index가 파일 끝에 있다고 가정
                // 마지막 24바이트는 Level Index (3 * uint64)
                const levelIndexStart = arrayBuffer.byteLength - 24;
                
                // 헤더 이후부터 Level Index 전까지 스캔
                for (let i = 100; i < levelIndexStart - 4; i++) {
                    // 가능한 Zstandard 시작점 찾기
                    if (bytes[i] === 0x28 || bytes[i] === 0xFD) {
                        const testLength = levelIndexStart - i;
                        if (testLength > 10 && testLength < arrayBuffer.byteLength) {
                            try {
                                const testData = new Uint8Array(arrayBuffer, i, testLength);
                                const result = fzstd.decompress(testData);
                                if (result && result.length > 0) {
                                    console.log(`[KTX2Worker] Found valid Zstandard data at offset ${i}`);
                                    zstdStart = i;
                                    break;
                                }
                            } catch (e) {
                                // 계속 시도
                            }
                        }
                    }
                }
            }
            
            if (zstdStart === -1) {
                throw new Error('Could not find Zstandard compressed data');
            }
            
            // Zstandard 압축 데이터의 끝 찾기
            // 방법 1: 파일 끝에서 역으로 Level Index 찾기
            const view = new DataView(arrayBuffer);
            let levelIndexStart = -1;
            
            // 파일 끝에서부터 거꾸로 스캔하여 유효한 Level Index 찾기
            // Level Index는 3개의 uint64 (offset, compressedSize, uncompressedSize)
            for (let i = arrayBuffer.byteLength - 24; i > zstdStart + 100; i -= 8) {
                try {
                    const offset = Number(view.getBigUint64(i, true));
                    const compSize = Number(view.getBigUint64(i + 8, true));
                    const uncompSize = Number(view.getBigUint64(i + 16, true));
                    
                    // 유효성 검사: offset이 zstdStart와 일치하면 Level Index일 가능성 높음
                    if (offset === zstdStart && compSize > 0 && compSize < arrayBuffer.byteLength &&
                        uncompSize > 0 && uncompSize < 1000000) { // 1MB 이하
                        levelIndexStart = i;
                        console.log(`[KTX2Worker] Found Level Index at ${i}: offset=${offset}, compressed=${compSize}, uncompressed=${uncompSize}`);
                        break;
                    }
                } catch (e) {
                    // 계속 스캔
                }
            }
            
            // Level Index를 못 찾은 경우, 파일 끝까지 사용
            let zstdEnd;
            if (levelIndexStart > 0) {
                zstdEnd = levelIndexStart;
            } else {
                // 기본값: 파일 끝에서 24바이트 전
                zstdEnd = arrayBuffer.byteLength - 24;
                // console.log(`[KTX2Worker] Using default Level Index position`);
                
                // Level Index 내용 확인
                try {
                    const offset = Number(view.getBigUint64(zstdEnd, true));
                    const compSize = Number(view.getBigUint64(zstdEnd + 8, true));
                    const uncompSize = Number(view.getBigUint64(zstdEnd + 16, true));
                    // console.log(`[KTX2Worker] Level Index values: offset=${offset}, compressed=${compSize}, uncompressed=${uncompSize}`);
                    
                    // 압축 크기가 실제 데이터와 일치하는지 확인
                    if (compSize > 0 && compSize < zstdEnd - zstdStart) {
                        // Level Index의 압축 크기를 사용
                        zstdEnd = zstdStart + compSize;
                        console.log(`[KTX2Worker] Using compressed size from Level Index: ${compSize}`);
                    }
                } catch (e) {
                    console.log(`[KTX2Worker] Could not read Level Index`);
                }
            }
            
            const zstdLength = zstdEnd - zstdStart;
            
            // console.log(`[KTX2Worker] Decompressing from ${zstdStart} to ${zstdEnd} (${zstdLength} bytes)`);
            
            const compressedData = new Uint8Array(arrayBuffer, zstdStart, zstdLength);
            
            // 처음 몇 바이트 확인
            let hexStart = '';
            for (let i = 0; i < Math.min(32, compressedData.length); i++) {
                hexStart += compressedData[i].toString(16).padStart(2, '0') + ' ';
            }
            // console.log(`[KTX2Worker] Compressed data starts with: ${hexStart}`);
            
            // Zstandard 프레임 헤더 파싱 시도
            // Magic Number(4) + Frame Header(1-14 bytes)
            if (compressedData[0] === 0x28 && compressedData[1] === 0xB5 && 
                compressedData[2] === 0x2F && compressedData[3] === 0xFD) {
                
                const frameHeaderByte = compressedData[4];
                const singleSegment = (frameHeaderByte & 0x20) !== 0;
                const contentSizeFlag = (frameHeaderByte >> 6) & 0x3;
                
                // console.log(`[KTX2Worker] Zstd frame: singleSegment=${singleSegment}, contentSizeFlag=${contentSizeFlag}`);
                
                // Content Size가 있으면 읽기
                let frameHeaderSize = 5; // magic(4) + descriptor(1)
                if (contentSizeFlag > 0) {
                    const contentSizeBytes = contentSizeFlag === 3 ? 8 : (1 << contentSizeFlag);
                    frameHeaderSize += contentSizeBytes;
                    
                    // Content size 읽기 (little endian)
                    let contentSize = 0;
                    for (let i = 0; i < contentSizeBytes; i++) {
                        contentSize |= compressedData[5 + i] << (i * 8);
                    }
                    // console.log(`[KTX2Worker] Zstd content size: ${contentSize} bytes`);
                }
            }
            
            let decompressed;
            
            // 실제 압축 데이터는 대부분 파일 끝까지
            // Level Index 유무와 관계없이 모든 가능한 끝 지점 시도
            const possibleLengths = [];
            
            // 파일 끝까지
            possibleLengths.push(arrayBuffer.byteLength - zstdStart);
            
            // 파일 끝에서 다양한 오프셋 빼기 (Level Index 또는 padding일 수 있음)
            for (let endPadding = 0; endPadding <= 64; endPadding++) {
                const testLength = (arrayBuffer.byteLength - endPadding) - zstdStart;
                if (testLength > 100) {
                    possibleLengths.push(testLength);
                }
            }
            
            // 중복 제거 및 내림차순 정렬 (긴 것부터 시도)
            const uniqueLengths = [...new Set(possibleLengths)].sort((a, b) => b - a);
            
            // console.log(`[KTX2Worker] Will try ${uniqueLengths.length} different lengths`);
            
            for (const tryLength of uniqueLengths) {
                if (tryLength > 0 && zstdStart + tryLength <= arrayBuffer.byteLength) {
                    try {
                        const tryData = new Uint8Array(arrayBuffer, zstdStart, tryLength);
                        decompressed = fzstd.decompress(tryData);
                        // console.log(`[KTX2Worker] Success at length ${tryLength}! Decompressed to ${decompressed.length} bytes`);
                        
                        // 압축 해제 크기가 예상과 맞는지 확인
                        if (decompressed.length === 768) {
                            console.log(`[KTX2Worker] Perfect match with expected size 768`);
                        }
                        break;
                    } catch (e) {
                        // 에러 로깅 없이 계속
                    }
                }
            }
            
            if (!decompressed) {
                console.error('[KTX2Worker] All decompression attempts failed');
                console.log('[KTX2Worker] File structure might be different than expected');
                throw new Error('Failed to decompress Zstandard data');
            }
            
            // BC7 포맷 체크
            let format = 'rgba8unorm';
            const expectedBC7Size = Math.ceil(header.pixelWidth / 4) * Math.ceil(header.pixelHeight / 4) * 16;
            
            if (decompressed.length === expectedBC7Size) {
                format = 'bc7-rgba-unorm';
                // console.log(`[KTX2Worker] Confirmed BC7 format`);
            } else {
                console.log(`[KTX2Worker] Size ${decompressed.length} != expected BC7 size ${expectedBC7Size}`);
            }
            
            return {
                data: decompressed,
                width: header.pixelWidth,
                height: header.pixelHeight,
                format: format
            };
        }
        // 다른 압축 방식
        else {
            throw new Error(`Unsupported compression: ${header.supercompressionScheme}`);
        }
        
    } catch (error) {
        console.error(`[KTX2Worker] Error:`, error);
        
        // 폴백: 더미 텍스처
        const size = 64;
        const data = new Uint8Array(size * size * 4);
        
        // 회색으로 채우기
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 180;     // R
            data[i + 1] = 180; // G
            data[i + 2] = 180; // B
            data[i + 3] = 255; // A
        }
        
        return {
            data: data,
            width: size,
            height: size,
            format: 'rgba8unorm'
        };
    }
}

/**
 * 메시지 처리
 */
async function handleMessage(data) {
    const { type, id, url } = data;
    
    if (type === 'loadKTX2') {
        try {
            const result = await loadKTX2Texture(url, id);
            
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
            self.postMessage({
                type: 'textureError',
                id: id,
                error: error.message
            });
        }
    }
}

/**
 * 메시지 리스너
 */
self.addEventListener('message', async (e) => {
    // console.log(`[KTX2Worker] Received message:`, e.data.type);
    
    if (!isInitialized) {
        pendingMessages.push(e.data);
        if (pendingMessages.length === 1) {
            await initZstd();
        }
        return;
    }
    
    handleMessage(e.data);
});

// 초기화
initZstd().then(() => {
    console.log('[KTX2Worker] Ready');
    self.postMessage({ type: 'ready' });
}).catch(error => {
    console.error('[KTX2Worker] Init failed:', error);
    self.postMessage({ type: 'error', error: error.message });
});