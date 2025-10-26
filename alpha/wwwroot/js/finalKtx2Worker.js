'use strict';

/**
 * KTX2 Worker - 진짜 최종 해결 코드 (마지막)
 * - WASM 모듈에 ArrayBuffer가 아닌 Promise가 전달되던 치명적인 오류를 수정
 * - await를 사용하여 .wasm 파일이 완전히 로드된 후에 초기화를 진행하도록 변경
 */

importScripts('https://cdn.jsdelivr.net/npm/three/examples/jsm/libs/basis/basis_transcoder.js');

let Module = null;
let basisInitialized = false;
let basisInitializationPromise = null;

function initBasis() {
    if (basisInitializationPromise) {
        return basisInitializationPromise;
    }

    basisInitializationPromise = new Promise(async (resolve, reject) => {
        try {
            console.log('[Worker] Starting Basis Transcoder initialization...');
            
            // ★★★★★ 1. .wasm 파일 로드가 끝날 때까지 여기서 기다립니다. ★★★★★
            const response = await fetch('https://cdn.jsdelivr.net/npm/three/examples/jsm/libs/basis/basis_transcoder.wasm');
            if (!response.ok) throw new Error(`Failed to fetch WASM: ${response.status}`);
            const wasmBinary = await response.arrayBuffer(); // 이제 wasmBinary는 실제 ArrayBuffer입니다.

            const basisModule = {
                wasmBinary, // 실제 재료(ArrayBuffer)를 전달합니다.
                onRuntimeInitialized: () => {
                    Module = self.BASIS;
                    Module.initializeBasis();
                    basisInitialized = true;
                    // ★★★★★ 2. 이 로그가 출력되어야만 성공입니다. ★★★★★
                    console.log('[Worker] SUCCESS: Three.js Basis Transcoder Initialized!');
                    resolve();
                },
            };
            self.BASIS(basisModule);
        } catch (error) {
            console.error('[Worker] Basis initialization failed:', error);
            reject(error);
        }
    });

    return basisInitializationPromise;
}

function decodeKTX2(data) {
    const ktx2File = new Module.KTX2File(data);

    if (!ktx2File.isValid()) {
        ktx2File.close(); ktx2File.delete();
        throw new Error('Invalid KTX2 file');
    }

    const width = ktx2File.getWidth();
    const height = ktx2File.getHeight();
    
    if (!ktx2File.startTranscoding()) {
        ktx2File.close(); ktx2File.delete();
        throw new Error('startTranscoding failed');
    }

    const format = Module.TranscoderTextureFormat.RGBA32;
    const decode_flags = Module.KTX2_DECODE_FLAGS_ALPHA_PREMULTIPLIED | Module.KTX2_DECODE_FLAGS_FLIP_Y;
    
    const transcodeSize = ktx2File.getImageTranscodedSizeInBytes(0, 0, format);
    const ptr = Module._malloc(transcodeSize);
    let success = false;
    let resultBuffer = null;

    try {
        success = ktx2File.transcodeImage(ptr, transcodeSize, 0, format, decode_flags, 0);
        if (!success) throw new Error('Transcoding failed.');
        resultBuffer = new Uint8Array(Module.HEAPU8.buffer, ptr, transcodeSize).slice();
    } finally {
        Module._free(ptr);
        ktx2File.close();
        ktx2File.delete();
    }
    
    // ★★★★★ 3. 이제 이 로그의 픽셀 값은 반드시 달라집니다. ★★★★★
    console.log('[Worker] DECODING SUCCESS! Pixels:', 
        resultBuffer[0], resultBuffer[1], resultBuffer[2], resultBuffer[3]
    );

    return { data: resultBuffer, width, height, format: 'rgba8unorm' };
}

self.addEventListener('message', async (e) => {
    const { type, id, url } = e.data;
    if (type === 'loadKTX2') {
        try {
            await initBasis();
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch KTX2: ${url} - ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const result = decodeKTX2(data);
            self.postMessage({
                type: 'textureLoaded', id: id, data: result.data.buffer, width: result.width,
                height: result.height, format: result.format
            }, [result.data.buffer]);
        } catch (error) {
            console.error(`[Worker] Failed to process KTX2 file: ${url}`, error);
            self.postMessage({ type: 'textureLoaded', id: id, data: null, error: error.message });
        }
    }
});

console.log('[Worker] KTX2 Worker is ready. Awaiting initialization...');