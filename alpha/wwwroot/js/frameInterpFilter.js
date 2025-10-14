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
                // 기본 두 프레임 샘플
                vec4 a = texture2D(uFrameA, vTextureCoord);
                vec4 b = texture2D(uFrameB, vTextureCoord);

                // 픽셀 간 차이로 "움직임 강도" 추정
                float motion = length(b.rgb - a.rgb);

                // 화면 중앙을 기준으로 미세한 이동 보정 (motion-based UV offset)
                vec2 offset = motion * 0.002 * (vec2(0.5) - vTextureCoord);

                // ease-in/out 곡선으로 보간 곡선 부드럽게
                float w = smoothstep(0.0, 1.0, pow(uMix, 1.2));

                // 오프셋 적용된 보간 샘플링
                vec4 colorA = texture2D(uFrameA, vTextureCoord - offset * (1.0 - w));
                vec4 colorB = texture2D(uFrameB, vTextureCoord + offset * w);

                // 두 프레임 혼합
                vec4 mixed = mix(colorA, colorB, w);

                // 감마 및 대비 보정으로 뿌연 느낌 제거
                mixed.rgb = pow(mixed.rgb, vec3(0.95));
                mixed.rgb = clamp(mixed.rgb * 1.05, 0.0, 1.0);

                gl_FragColor = mixed;
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
