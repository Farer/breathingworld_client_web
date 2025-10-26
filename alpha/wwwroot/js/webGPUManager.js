'use strict';

/**
 * WebGPU 기반 텍스처 관리 시스템
 * - 동적 텍스처 로딩/언로딩
 * - 스케일별 텍스처 관리
 * - 효율적인 메모리 관리
 */
export class WebGPUManager {
    constructor(targetElement, worker) {
        if (!targetElement) throw new Error("Invalid targetElement");

        this.targetElement = targetElement;
        this.worker = worker;
        this.isReady = false;

        // WebGPU 관련 리소스
        this.device = null;
        this.context = null;
        this.canvas = null;
        this.format = null;

        // 렌더 파이프라인
        this.pipeline = null;
        this.renderPassDescriptor = null;

        // 텍스처 관리
        this.textureCache = new Map(); // 텍스처 캐시
        this.textureBindGroups = new Map(); // 바인드 그룹 캐시
        this.loadingQueue = new Set(); // 로딩 중인 텍스처
        this.pendingLoads = new Map(); // 대기 중인 로드 요청

        // 현재 스케일
        this.currentScale = 1;

        // 텍스처 설정
        this.textureConfig = {
            ground: { size: 128, count: 16 },
            weed: { size: 512, count: 17 },
            tree: { size: 1024, count: 12 },
            rabbit: { size: 512, frameCount: 60 },
            wolf: { size: 256, frameCount: 41 }
        };

        // 레이어 관리
        this.layers = {
            ground: { sprites: new Map(), zIndex: 0 },
            weed: { sprites: new Map(), zIndex: 1 },
            shadow: { sprites: new Map(), zIndex: 2 },
            entity: { sprites: new Map(), zIndex: 3 }
        };

        // 성능 모니터링
        this.stats = {
            fps: 0,
            drawCalls: 0,
            textureMemory: 0,
            loadedTextures: 0,
            cacheHits: 0,
            cacheMisses: 0
        };

        // 애니메이션 관리
        this.animationFrames = new Map();
        this.activeAnimations = new Set();

        this._lastFrameTime = 0;
        this._frameCount = 0;
        this._fpsUpdateTime = 0;
    }

    showLoader() {
        Variables.Doms.get('texture-loader').style.opacity = 1;
    }

    hideLoader() {
        Variables.Doms.get('texture-loader').style.opacity = 0;
    }

    /**
     * 비동기 초기화
     */
    static async create(targetElement, worker) {
        const manager = new WebGPUManager(targetElement, worker);
        await manager.init();
        return manager;
    }

    /**
     * WebGPU 초기화
     */
    async init() {
        console.log('🔧 Starting WebGPU initialization...');

        // WebGPU 지원 확인
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported");
        }

        // 플랫폼 감지
        const isWindows = navigator.platform?.indexOf('Win') > -1 ||
            navigator.userAgent?.indexOf('Windows') > -1;

        console.log(`📱 Platform: ${navigator.platform}, Windows: ${isWindows}`);

        // GPU 어댑터 요청 (Windows에서는 powerPreference 제외)
        const adapterOptions = {};
        if (!isWindows) {
            adapterOptions.powerPreference = 'high-performance';
        }

        console.log('🔍 Requesting GPU adapter...');
        const adapter = await navigator.gpu.requestAdapter(adapterOptions);

        if (!adapter) {
            throw new Error("No GPU adapter found");
        }

        // 어댑터 정보 로깅 (지원하는 경우)
        if (adapter.requestAdapterInfo) {
            try {
                const adapterInfo = await adapter.requestAdapterInfo();
                console.log('📊 GPU Adapter Info:', {
                    vendor: adapterInfo.vendor,
                    architecture: adapterInfo.architecture,
                    device: adapterInfo.device,
                    description: adapterInfo.description
                });
            } catch (e) {
                console.log('ℹ️ Adapter info not available');
            }
        }

        // 어댑터 기능 확인
        console.log('🔧 Adapter features:', Array.from(adapter.features));
        console.log('📏 Adapter limits:', {
            maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
            maxBufferSize: `${(adapter.limits.maxBufferSize / (1024 * 1024)).toFixed(2)}MB`,
            maxTextureArrayLayers: adapter.limits.maxTextureArrayLayers
        });

        // 디바이스 생성
        this.device = await adapter.requestDevice({
            requiredFeatures: adapter.features.has('texture-compression-bc')
                ? ['texture-compression-bc']
                : [], // BC 압축이 지원되지 않으면 빈 배열
            requiredLimits: {
                maxTextureDimension2D: Math.min(adapter.limits.maxTextureDimension2D, 8192),
                maxBufferSize: Math.min(adapter.limits.maxBufferSize, 268435456), // 256MB
                maxTextureArrayLayers: Math.min(adapter.limits.maxTextureArrayLayers, 256)
            }
        });

        console.log('✅ WebGPU Device created successfully');

        // 디바이스 로스트 핸들링
        this.device.lost.then(info => {
            console.error(`⚠️ WebGPU device lost: ${info.reason}`, info.message);
            this.handleDeviceLost();
        });

        // 캔버스 설정
        console.log('🎨 Setting up canvas...');
        this.setupCanvas();

        // 렌더 파이프라인 생성
        console.log('🔧 Creating render pipeline...');
        await this.createRenderPipeline();

        // 기본 텍스처 로드
        console.log('📦 Loading basic assets...');
        await this.loadBasicAssets();

        // 렌더링 시작
        console.log('🎬 Starting render loop...');
        this.startRenderLoop();

        this.isReady = true;
        console.log('✅ WebGPU Manager initialized successfully!');
        console.log('📊 Initial stats:', this.getStats());
    }

    /**
     * 캔버스 설정
     */
    setupCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.targetElement.appendChild(this.canvas);

        this.context = this.canvas.getContext('webgpu');
        this.format = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: 'premultiplied',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        });

        // 리사이즈 핸들러
        window.addEventListener('resize', () => this.handleResize());
    }

    /**
     * 렌더 파이프라인 생성
     */
    async createRenderPipeline() {
        // 셰이더 모듈 생성
        const shaderModule = this.device.createShaderModule({
            code: `
                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) texCoord: vec2<f32>,
                    @location(1) color: vec4<f32>,
                };

                struct Uniforms {
                    mvpMatrix: mat4x4<f32>,
                    opacity: f32,
                    scale: f32,
                    time: f32,
                };

                @group(0) @binding(0) var<uniform> uniforms: Uniforms;
                @group(1) @binding(0) var textureSampler: sampler;
                @group(1) @binding(1) var texture: texture_2d<f32>;

                @vertex
                fn vsMain(
                    @location(0) position: vec2<f32>,
                    @location(1) texCoord: vec2<f32>,
                    @location(2) color: vec4<f32>,
                    @builtin(instance_index) instanceIdx: u32
                ) -> VertexOutput {
                    var output: VertexOutput;
                    let pos = vec4<f32>(position * uniforms.scale, 0.0, 1.0);
                    output.position = uniforms.mvpMatrix * pos;
                    output.texCoord = texCoord;
                    output.color = color;
                    return output;
                }

                @fragment
                fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
                    let texColor = textureSample(texture, textureSampler, input.texCoord);
                    return texColor * input.color * vec4<f32>(1.0, 1.0, 1.0, uniforms.opacity);
                }
            `
        });

        // 버텍스 버퍼 레이아웃
        const vertexBufferLayout = {
            arrayStride: 32, // 2 floats position + 2 floats texCoord + 4 floats color
            attributes: [
                { format: 'float32x2', offset: 0, shaderLocation: 0 }, // position
                { format: 'float32x2', offset: 8, shaderLocation: 1 }, // texCoord
                { format: 'float32x4', offset: 16, shaderLocation: 2 } // color
            ]
        };

        // 바인드 그룹 레이아웃
        const uniformBindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            }]
        });

        const textureBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {}
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                }
            ]
        });

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [uniformBindGroupLayout, textureBindGroupLayout]
        });

        // 파이프라인 생성
        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vsMain',
                buffers: [vertexBufferLayout]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fsMain',
                targets: [{
                    format: this.format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        }
                    }
                }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none'
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus'
            }
        });

        // Uniform 버퍼 생성
        this.uniformBuffer = this.device.createBuffer({
            size: 256, // mat4x4 + padding
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.uniformBindGroup = this.device.createBindGroup({
            layout: uniformBindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer }
            }]
        });

        // 깊이 텍스처 생성
        this.createDepthTexture();
    }

    /**
     * 깊이 텍스처 생성
     */
    createDepthTexture() {
        this.depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height, 1],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });

        this.renderPassDescriptor = {
            colorAttachments: [{
                view: null, // 매 프레임 업데이트
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        };
    }

    /**
     * 동적 텍스처 로딩
     */
    async loadTexture(url, priority = 0) {
        const cacheKey = url;

        // 캐시 확인
        if (this.textureCache.has(cacheKey)) {
            this.stats.cacheHits++;
            return this.textureCache.get(cacheKey);
        }

        this.stats.cacheMisses++;

        // 이미 로딩 중인지 확인
        if (this.loadingQueue.has(cacheKey)) {
            return this.pendingLoads.get(cacheKey);
        }

        // 로딩 시작
        this.loadingQueue.add(cacheKey);

        const loadPromise = this.loadTextureInternal(url, priority);
        this.pendingLoads.set(cacheKey, loadPromise);

        try {
            const texture = await loadPromise;
            this.textureCache.set(cacheKey, texture);
            this.stats.loadedTextures++;
            this.updateMemoryStats();
            return texture;
        } finally {
            this.loadingQueue.delete(cacheKey);
            this.pendingLoads.delete(cacheKey);
        }
    }

    /**
     * 실제 텍스처 로딩 처리
     */
    async loadTextureInternal(url, priority) {
        // Worker를 통한 KTX2 디코딩 지원
        if (this.worker && url.endsWith('.ktx2')) {
            return this.loadKTX2Texture(url, priority);
        }

        // 일반 이미지 로딩
        const response = await fetch(url);
        const blob = await response.blob();
        const imageBitmap = await createImageBitmap(blob);

        const texture = this.device.createTexture({
            size: [imageBitmap.width, imageBitmap.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT
        });

        this.device.queue.copyExternalImageToTexture(
            { source: imageBitmap },
            { texture },
            [imageBitmap.width, imageBitmap.height]
        );

        // 바인드 그룹 생성
        const sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear'
        });

        const bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: texture.createView() }
            ]
        });

        return { texture, bindGroup, width: imageBitmap.width, height: imageBitmap.height };
    }

    /**
     * KTX2 텍스처 로딩 (Worker 사용)
     */
    async loadKTX2Texture(url, priority) {
        return new Promise((resolve, reject) => {
            const id = Math.random().toString(36);

            this.worker.postMessage({
                type: 'loadKTX2',
                id,
                url,
                priority
            });

            const handler = (e) => {
                if (e.data.id === id) {
                    this.worker.removeEventListener('message', handler);

                    if (e.data.error) {
                        reject(new Error(e.data.error));
                        return;
                    }

                    const { data, width, height, format } = e.data;

                    const texture = this.device.createTexture({
                        size: [width, height, 1],
                        format: format || 'bc7-rgba-unorm',
                        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
                    });

                    this.device.queue.writeTexture(
                        { texture },
                        data,
                        { bytesPerRow: Math.ceil(width / 4) * 16 },
                        [width, height]
                    );

                    const sampler = this.device.createSampler({
                        magFilter: 'linear',
                        minFilter: 'linear'
                    });

                    const bindGroup = this.device.createBindGroup({
                        layout: this.pipeline.getBindGroupLayout(1),
                        entries: [
                            { binding: 0, resource: sampler },
                            { binding: 1, resource: texture.createView() }
                        ]
                    });

                    resolve({ texture, bindGroup, width, height });
                }
            };

            this.worker.addEventListener('message', handler);
        });
    }

    /**
     * 스케일 변경 처리
     */
    async applyTextureImmediately(newScale) {
        this.currentScale = newScale;

        console.log(`📐 Applying scale ${newScale}`);

        // 현재 스케일과 다른 텍스처 언로드
        await this.unloadTexturesForOtherScales(newScale);

        // 현재 스케일의 텍스처 미리 로드
        await this.preloadTexturesForScale(newScale);
    }

    /**
     * 동물 프레임 예약 로딩
     */
    async reserveLoadAnimalFrames(species, lifeStage, scale) { console.log("[WebGPUManager] Skipped - handled by WebGPUController"); return; }
//     async reserveLoadAnimalFrames(species, lifeStage, scale) {
//         const baseUrl = `/img/ktx2/${species}/${lifeStage}/${scale}`;
//         const MAX_FRAMES = this._isSafari ? 30 : 100;
//         // const animations = ['idle_1', 'idle_2', 'walk_1', 'run_1', 'eat_1', 'sleep_3'];
//         const animations = ['idle_1', 'idle_2', 'run_1'];
//         let actualFrameCount;
//         // 애니메이션별로 프레임 로드
//         const loadPromises = [];
//         for (const animationKind of animations) {
//             if (species === 'rabbit') {
//                 if (animationKind === 'idle_1') actualFrameCount = 35;
//                 else if (animationKind === 'idle_2') actualFrameCount = 22;
//                 else if (animationKind === 'walk_1') actualFrameCount = 21;
//                 else if (animationKind === 'run_1') actualFrameCount = 14;
//                 else if (animationKind === 'sleep_3') actualFrameCount = 12;
//                 else actualFrameCount = 1;
//             } else {
//                 actualFrameCount = MAX_FRAMES;
//             }
//             const directions = this.getDirectionsForAnimation(species);
//             for (const dir of directions) {
//                 const path = `${baseUrl}/${animationKind}/${dir}`;
//                 for (let i = 0; i < actualFrameCount; i++) {
//                     const num = i.toString().padStart(4, "0");
//                     const url = `${path}/frame_${num}.ktx2`;
//                     loadPromises.push(this.loadTexture(url, 1));
//                 }
//             }
//         }
//         this.showLoader();
//         console.log(`🐾 Reserved loading: ${species}/${lifeStage} at scale ${scale}`);
//         await Promise.all(loadPromises);
//         this.hideLoader();
//         console.log(`✅ Animal frames loaded: ${species}/${lifeStage} at scale ${scale}`);
//     }
// 
    /**
     * 기본 에셋 로드
     */
    async loadBasicAssets() {
        return;
        // Ground, Weed 등 기본 스프라이트 시트 로드
        const basicAssets = [
            '/img/sprites/sprite_ground_with_droppings_rgba_opti.png',
            '/img/sprites/sprite_weed_512_opti.png'
        ];

        for (const url of basicAssets) {
            await this.loadTexture(url);
        }
    }

    /**
     * 렌더링 루프
     */
    startRenderLoop() {
        const render = (timestamp) => {
            this.updateStats(timestamp);
            this.render();
            requestAnimationFrame(render);
        };

        requestAnimationFrame(render);
    }

    /**
     * 메인 렌더링 함수
     */
    render() {
        // 현재 텍스처 뷰 가져오기
        const currentTexture = this.context.getCurrentTexture();
        this.renderPassDescriptor.colorAttachments[0].view = currentTexture.createView();

        // 커맨드 인코더 생성
        const commandEncoder = this.device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass(this.renderPassDescriptor);

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.uniformBindGroup);

        // 레이어별 렌더링
        this.renderLayers(renderPass);

        renderPass.end();

        // GPU에 제출
        this.device.queue.submit([commandEncoder.finish()]);

        this.stats.drawCalls++;
    }

    /**
     * 레이어별 렌더링
     */
    renderLayers(renderPass) {
        const sortedLayers = Object.values(this.layers)
            .sort((a, b) => a.zIndex - b.zIndex);

        for (const layer of sortedLayers) {
            this.renderLayer(renderPass, layer);
        }
    }

    /**
     * 단일 레이어 렌더링
     */
    renderLayer(renderPass, layer) {
        const sprites = Array.from(layer.sprites.values())
            .filter(sprite => sprite.visible);

        // Y 좌표로 정렬 (깊이 정렬)
        sprites.sort((a, b) => a.y - b.y);

        for (const sprite of sprites) {
            this.renderSprite(renderPass, sprite);
        }
    }

    /**
     * 스프라이트 렌더링
     */
    renderSprite(renderPass, sprite) {
        // 버텍스 버퍼가 없으면 생성
        if (!sprite.vertexBuffer) {
            this.createSpriteBuffers(sprite);
        }

        // 텍스처 바인드 그룹 확인
        if (!sprite.textureBindGroup) {
            return; // 텍스처가 아직 로드되지 않음
        }

        // MVP 매트릭스 업데이트
        this.updateSpriteUniforms(sprite);

        // 그리기 명령
        renderPass.setVertexBuffer(0, sprite.vertexBuffer);
        renderPass.setIndexBuffer(sprite.indexBuffer, 'uint16');
        renderPass.setBindGroup(1, sprite.textureBindGroup);
        renderPass.drawIndexed(6); // 2 triangles = 6 indices
    }

    /**
     * 스프라이트 버퍼 생성
     */
    createSpriteBuffers(sprite) {
        // 버텍스 데이터 (position, texCoord, color)
        const vertices = new Float32Array([
            // x, y, u, v, r, g, b, a
            -0.5, -0.5, 0, 1, 1, 1, 1, 1,
            0.5, -0.5, 1, 1, 1, 1, 1, 1,
            0.5, 0.5, 1, 0, 1, 1, 1, 1,
            -0.5, 0.5, 0, 0, 1, 1, 1, 1
        ]);

        sprite.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        this.device.queue.writeBuffer(sprite.vertexBuffer, 0, vertices);

        // 인덱스 버퍼
        const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

        sprite.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        });

        this.device.queue.writeBuffer(sprite.indexBuffer, 0, indices);
    }

    /**
     * 스프라이트 유니폼 업데이트
     */
    updateSpriteUniforms(sprite) {
        // MVP 매트릭스 계산
        const mvpMatrix = this.calculateMVPMatrix(sprite);

        // 유니폼 데이터
        const uniformData = new Float32Array([
            ...mvpMatrix,
            sprite.opacity || 1.0,
            sprite.scale || 1.0,
            performance.now() / 1000
        ]);

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    }

    /**
     * MVP 매트릭스 계산
     */
    calculateMVPMatrix(sprite) {
        // 간단한 2D 변환 매트릭스
        const scaleX = sprite.scale * (sprite.width / this.canvas.width) * 2;
        const scaleY = sprite.scale * (sprite.height / this.canvas.height) * 2;
        const posX = (sprite.x / this.canvas.width) * 2 - 1;
        const posY = 1 - (sprite.y / this.canvas.height) * 2;

        return new Float32Array([
            scaleX, 0, 0, 0,
            0, scaleY, 0, 0,
            0, 0, 1, 0,
            posX, posY, 0, 1
        ]);
    }

    /**
     * 다른 스케일의 텍스처 언로드
     */
    async unloadTexturesForOtherScales(currentScale) {
        const toUnload = [];

        for (const [key, textureData] of this.textureCache.entries()) {
            // URL에서 스케일 추출 (예: /textures/rabbit/adult/32/...)
            const scaleMatch = key.match(/\/(\d+)\//);
            if (scaleMatch) {
                const textureScale = parseInt(scaleMatch[1]);
                if (textureScale !== currentScale) {
                    toUnload.push(key);
                }
            }
        }

        for (const key of toUnload) {
            const textureData = this.textureCache.get(key);
            if (textureData?.texture) {
                textureData.texture.destroy();
            }
            this.textureCache.delete(key);
            this.stats.loadedTextures--;
        }

        if (toUnload.length > 0) {
            console.log(`🗑️ Unloaded ${toUnload.length} textures from other scales`);
            this.updateMemoryStats();
        }
    }

    /**
     * 스케일에 맞는 텍스처 미리 로드
     */
    async preloadTexturesForScale(scale) {
        const preloadList = this.getPreloadList(scale);

        const loadPromises = preloadList.map(url =>
            this.loadTexture(url, 0) // 낮은 우선순위
        );

        await Promise.allSettled(loadPromises);
        console.log(`📦 Preloaded textures for scale ${scale}`);
    }

    /**
     * 프리로드 목록 생성
     */
    getPreloadList(scale) {
        const list = [];

        // 스케일별 기본 텍스처 URL 생성
        // 예시: 각 스케일에 맞는 ground, tree 텍스처 등
        // list.push(`/textures/ground/${scale}/texture.ktx2`);
        // list.push(`/textures/tree/${scale}/texture.ktx2`);

        return list;
    }

    /**
     * 동물 텍스처 URL 생성
     */
    getAnimalTextureURL(species, lifeStage, scale) {
        // 스케일 값을 직접 사용
        return `/img/ktx2/${species}/${lifeStage}/${scale}`;
    }

    /**
     * 애니메이션별 방향 목록
     */
    getDirectionsForAnimation(species) {
        // 토끼는 8방향
        if (species === 'rabbit') {
            return [
                'direction_00', 'direction_01', 'direction_02', 'direction_03',
                'direction_04', 'direction_05', 'direction_06', 'direction_07',
                'direction_08', 'direction_09', 'direction_10', 'direction_11',
                'direction_12', 'direction_13', 'direction_14', 'direction_15',
            ];
        }

        // 늑대는 4방향
        if (species === 'wolf') {
            return [
                'direction_00', 'direction_01', 'direction_02', 'direction_03',
                'direction_04', 'direction_05', 'direction_06', 'direction_07',
                'direction_08', 'direction_09', 'direction_10', 'direction_11',
                'direction_12', 'direction_13', 'direction_14', 'direction_15',
            ];
        }
        return [
            'direction_00', 'direction_01', 'direction_02', 'direction_03',
            'direction_04', 'direction_05', 'direction_06', 'direction_07',
            'direction_08', 'direction_09', 'direction_10', 'direction_11',
            'direction_12', 'direction_13', 'direction_14', 'direction_15',
        ];
    }

    /**
     * 씬 데이터 초기화
     */
    clearSceneData() {
        for (const layer of Object.values(this.layers)) {
            layer.sprites.clear();
        }

        this.activeAnimations.clear();
        console.log('🧹 Scene data cleared');
    }

    /**
     * 씬 초기화
     */
    clearScene() {
        this.clearSceneData();

        // 렌더 패스 초기화가 필요한 경우
        if (this.renderPassDescriptor) {
            this.renderPassDescriptor.colorAttachments[0].loadOp = 'clear';
        }

        console.log('🧹 Scene cleared');
    }

    /**
     * 통계 업데이트
     */
    updateStats(timestamp) {
        this._frameCount++;

        if (timestamp - this._fpsUpdateTime >= 1000) {
            this.stats.fps = this._frameCount;
            this._frameCount = 0;
            this._fpsUpdateTime = timestamp;

            // 메모리 통계 업데이트
            this.updateMemoryStats();
        }
    }

    /**
     * 메모리 통계 업데이트
     */
    updateMemoryStats() {
        let totalMemory = 0;

        for (const [key, data] of this.textureCache.entries()) {
            if (data.width && data.height) {
                // RGBA 8bit per channel = 4 bytes per pixel
                totalMemory += data.width * data.height * 4;
            }
        }

        this.stats.textureMemory = Math.round(totalMemory / (1024 * 1024)); // MB 단위
    }

    /**
     * 리사이즈 핸들러
     */
    handleResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // 깊이 텍스처 재생성
        if (this.depthTexture) {
            this.depthTexture.destroy();
        }
        this.createDepthTexture();

        // 컨텍스트 재설정
        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: 'premultiplied',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        });
    }

    /**
     * 디바이스 로스트 처리
     */
    async handleDeviceLost() {
        console.warn('⚠️ WebGPU device lost, attempting to recover...');

        // 기존 리소스 정리
        this.cleanup();

        // 재초기화 시도
        try {
            await this.init();
            console.log('✅ WebGPU device recovered successfully');
        } catch (error) {
            console.error('❌ Failed to recover WebGPU device:', error);
            // 폴백 처리 (예: WebGL로 전환)
        }
    }

    /**
     * 정리 함수
     */
    cleanup() {
        console.log('🧹 Cleaning up WebGPU Manager...');

        // 애니메이션 정지
        this.activeAnimations.clear();

        // 텍스처 정리
        for (const textureData of this.textureCache.values()) {
            if (textureData?.texture) {
                textureData.texture.destroy();
            }
        }
        this.textureCache.clear();

        // 버퍼 정리
        if (this.uniformBuffer) {
            this.uniformBuffer.destroy();
        }

        // 깊이 텍스처 정리
        if (this.depthTexture) {
            this.depthTexture.destroy();
        }

        // 레이어 정리
        for (const layer of Object.values(this.layers)) {
            layer.sprites.clear();
        }

        // 디바이스 정리
        if (this.device) {
            this.device.destroy();
        }

        // DOM 정리
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }

        console.log('✅ WebGPU Manager cleanup complete');
    }

    /**
     * 통계 정보 가져오기
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.textureCache.size,
            loadingQueue: this.loadingQueue.size,
            activeAnimations: this.activeAnimations.size,
            currentScale: this.currentScale,
            cacheEfficiency: this.stats.cacheHits > 0
                ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(1) + '%'
                : 'N/A'
        };
    }
}