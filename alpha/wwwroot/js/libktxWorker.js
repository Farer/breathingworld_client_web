'use strict';

/**
 * PixiJS와 동일한 libktx 사용
 */

importScripts('/js/libktx.js');

let libktx = null;
let isReady = false;

async function initLibKTX() {
    if (isReady) return;
    
    return new Promise((resolve) => {
        LIBKTX({
            locateFile: (file) => {
                if (file.endsWith('.wasm')) {
                    return '/js/libktx.wasm';
                }
                return file;
            }
        }).then((module) => {
            libktx = module;
            
            // API 확인
            console.log('[LibKTX] Available functions:', Object.keys(module));
            console.log('[LibKTX] Module:', module);
            
            // KTX 관련 클래스/함수 찾기
            if (module.KTXTexture) {
                console.log('[LibKTX] Found KTXTexture');
            }
            if (module.ktxTexture2_Create) {
                console.log('[LibKTX] Found ktxTexture2_Create');
            }
            if (module.ktxTexture_CreateFromMemory) {
                console.log('[LibKTX] Found ktxTexture_CreateFromMemory');
            }
            
            isReady = true;
            console.log('[LibKTX] Initialized');
            resolve();
        });
    });
}

function decodeKTX2(data) {
    // libktx는 ktxTexture 클래스를 제공 (소문자 k!)
    const ktxTexture = new libktx.ktxTexture(data);
    
    try {
        const width = ktxTexture.baseWidth;
        const height = ktxTexture.baseHeight;
        const levels = ktxTexture.numLevels;
        const needsTranscoding = ktxTexture.needsTranscoding;
        
        console.log(`[LibKTX] ${width}x${height}, levels:${levels}, needsTranscoding:${needsTranscoding}`);
        
        // 트랜스코딩이 필요한 경우
        if (needsTranscoding) {
            // TranscodeTarget enum - libktx의 실제 값 확인
            const formats = {
                RGBA32: 'RGBA32',
                RGB565: 'RGB565', 
                RGBA4444: 'RGBA4444',
                ETC1_RGB: 'ETC1_RGB',
                BC1_RGB: 'BC1_RGB',
                BC3_RGBA: 'BC3_RGBA',
                BC4_R: 'BC4_R',
                BC5_RG: 'BC5_RG',
                BC7_RGBA: 'BC7_RGBA',
                ASTC_4x4_RGBA: 'ASTC_4x4_RGBA',
                ETC2_RGBA: 'ETC2_RGBA',
                PVRTC1_4_RGB: 'PVRTC1_4_RGB',
                PVRTC1_4_RGBA: 'PVRTC1_4_RGBA'
            };
            
            // TranscodeTarget enum 확인
            if (libktx.TranscodeTarget) {
                console.log('[LibKTX] TranscodeTarget:', libktx.TranscodeTarget);
            }
            
            // RGBA32 시도
            let targetFormat = libktx.TranscodeTarget?.RGBA32 || 13;
            
            // transcodeBasis(format, transcodeFlags)
            const result = ktxTexture.transcodeBasis(targetFormat, 0);
            
            if (result !== 0) { // 0 = SUCCESS
                console.log(`[LibKTX] Transcode failed with error code: ${result}`);
                // 다른 포맷 시도
                targetFormat = libktx.TranscodeTarget?.BC7_RGBA || libktx.TranscodeTarget?.ASTC_4x4_RGBA || 13;
                const result2 = ktxTexture.transcodeBasis(targetFormat, 0);
                if (result2 !== 0) {
                    ktxTexture.delete();
                    throw new Error(`All transcode attempts failed`);
                }
            }
        }
        
        // 첫 번째 mip level의 데이터 가져오기
        const imageData = ktxTexture.getImageData(0, 0, 0);
        
        console.log(`[LibKTX] Image data size: ${imageData.byteLength}`);
        
        // Uint8Array로 복사
        const buffer = new Uint8Array(imageData.byteLength);
        buffer.set(new Uint8Array(imageData));
        
        // 처음 몇 픽셀 확인
        console.log('[LibKTX] First pixels:', 
            buffer[0], buffer[1], buffer[2], buffer[3],
            buffer[4], buffer[5], buffer[6], buffer[7]
        );
        
        ktxTexture.delete();
        
        return {
            data: buffer,
            width: width,
            height: height,
            format: 'rgba8unorm'
        };
    } catch (e) {
        if (ktxTexture && ktxTexture.delete) {
            ktxTexture.delete();
        }
        throw e;
    }
}

self.addEventListener('message', async (e) => {
    const { type, id, url } = e.data;
    
    if (type === 'loadKTX2') {
        try {
            await initLibKTX();
            
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            
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
            console.error('[LibKTX] Error:', error);
            
            const size = 32;
            const fallback = new Uint8Array(size * size * 4);
            for (let i = 0; i < fallback.length; i += 4) {
                fallback[i] = 255;
                fallback[i + 1] = 0;
                fallback[i + 2] = 255;
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

console.log('[LibKTX] Worker ready with PixiJS libktx');