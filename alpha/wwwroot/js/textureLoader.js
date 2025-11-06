// textureLoader.js
import * as THREE from '/js/lib/three.module.js';
import { KTX2Loader } from '/js/lib/KTX2Loader.js';

export class TextureLoader {
    constructor(gl) {
        this.gl = gl;
        
        // Three.js KTX2Loader 사용
        this.ktx2Loader = new KTX2Loader();
        
        // ✅ /js/lib/ 경로 사용
        this.ktx2Loader.setTranscoderPath('/js/lib/');
        
        // WebGL 컨텍스트로 detectSupport
        const canvas = document.createElement('canvas');
        const tempRenderer = new THREE.WebGLRenderer({ canvas, context: gl });
        this.ktx2Loader.detectSupport(tempRenderer);
        
        console.log('✅ KTX2Loader initialized (local: /js/lib/)');
    }
    
    async init() {
        return Promise.resolve();
    }
    
    async loadKTX2(url) {
        return new Promise((resolve, reject) => {
            this.ktx2Loader.load(
                url,
                (texture) => {
                    // KTX2 텍스처 데이터 직접 반환
                    // texture.source.data가 WebGLTexture일 수 있음
                    const textureData = {
                        texture: texture.source?.data || texture,
                        width: texture.image?.width || 512,
                        height: texture.image?.height || 512
                    };
                    
                    resolve(textureData);
                },
                undefined,
                (error) => {
                    console.error(`Failed to load KTX2: ${url}`, error);
                    reject(error);
                }
            );
        });
    }
    
    uploadToGPU(data) {
        return data.texture;
    }
    
    destroy() {
        this.ktx2Loader.dispose();
    }
}