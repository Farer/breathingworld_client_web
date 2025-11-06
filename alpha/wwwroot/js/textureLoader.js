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
                    // Three.js texture 객체를 그대로 보관
                    // dispose 메서드가 있어야 메모리 해제 가능
                    resolve({
                        texture: texture,  // Three.js Texture 객체 전체
                        width: texture.image?.width || 512,
                        height: texture.image?.height || 512,
                        threeTexture: true
                    });
                },
                undefined,
                (error) => {
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