'use strict';

/**
 * Simple PNG Worker - KTX2 대신 PNG 사용
 */

// PNG 이미지를 로드하고 RGBA 데이터로 변환
async function loadPNG(url) {
    // KTX2 URL을 PNG로 변경
    const pngUrl = url.replace(/\.ktx2$/, '.png').replace('/ktx2/', '/png/');
    
    console.log(`[PNGWorker] Loading PNG: ${pngUrl}`);
    
    try {
        const response = await fetch(pngUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const blob = await response.blob();
        const imageBitmap = await createImageBitmap(blob);
        
        // Canvas를 사용해 RGBA 데이터 추출
        const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(imageBitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
        
        return {
            data: imageData.data.buffer,
            width: imageBitmap.width,
            height: imageBitmap.height,
            format: 'rgba8unorm'
        };
        
    } catch (error) {
        console.error(`[PNGWorker] Failed to load ${pngUrl}:`, error);
        
        // 폴백: 단색 텍스처
        const size = 32;
        const data = new Uint8Array(size * size * 4);
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 200;     // R
            data[i + 1] = 200; // G
            data[i + 2] = 200; // B
            data[i + 3] = 255; // A
        }
        
        return {
            data: data.buffer,
            width: size,
            height: size,
            format: 'rgba8unorm'
        };
    }
}

// 메시지 핸들러
self.addEventListener('message', async (event) => {
    const { type, id, url } = event.data;
    
    if (type === 'loadKTX2') {
        try {
            const result = await loadPNG(url);
            
            self.postMessage({
                type: 'textureLoaded',
                id: id,
                data: result.data,
                width: result.width,
                height: result.height,
                format: result.format
            }, [result.data]);
            
        } catch (error) {
            console.error('[PNGWorker] Error:', error);
            
            // 에러 텍스처
            const size = 32;
            const errorData = new Uint8Array(size * size * 4);
            
            for (let i = 0; i < errorData.length; i += 4) {
                errorData[i] = 255;     // R
                errorData[i + 1] = 0;   // G
                errorData[i + 2] = 0;   // B
                errorData[i + 3] = 255; // A
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

console.log('[PNGWorker] Worker ready - using PNG images instead of KTX2');