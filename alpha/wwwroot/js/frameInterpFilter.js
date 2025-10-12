'use strict';
class FrameInterpFilter extends PIXI.Filter {
    constructor() {
        const fragmentSrc = `
            precision highp float;
            varying vec2 vTextureCoord;
            uniform sampler2D uFrameA;
            uniform sampler2D uFrameB;
            uniform float uMix;

            void main(void) {
                vec4 a = texture2D(uFrameA, vTextureCoord);
                vec4 b = texture2D(uFrameB, vTextureCoord);
                gl_FragColor = mix(a, b, uMix);
            }
        `;
        super(null, fragmentSrc, {
            uFrameA: null,
            uFrameB: null,
            uMix: 0.0,
        });
    }

    setFrames(texA, texB, mix) {
        if (!this.uniforms) return; // 🧩 초기화 전 방어
        this.uniforms.uFrameA = texA;
        this.uniforms.uFrameB = texB;
        this.uniforms.uMix = mix;
    }
}
window.FrameInterpFilter = FrameInterpFilter;
