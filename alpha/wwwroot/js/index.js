'use strict';
import * as TWEEN from 'https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@20.0.3/dist/tween.esm.js';
import { WebGPUController } from '/js/webGPUController.js';
window.onload = async function () {
    // ★★★★★ 1. 이 코드를 추가하여 KTX 파서를 활성화합니다. ★★★★★
    // 이 코드는 여러분이 제공해주신, 이미 동작이 확인된 코드입니다.
    PIXI.compressedTextures?.setBasisTranscoderPath?.({
        jsUrl: "https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.js",
        wasmUrl: "https://cdn.jsdelivr.net/npm/pixi-basis-ktx2@0.0.20/assets/basis_transcoder.wasm"
    });
    if (PIXI.loadKTX2) {
        PIXI.Assets.loader.parsers.push(PIXI.loadKTX2);
    }
    // ★★★★★ 여기까지 추가 ★★★★★
    const selectedRegion = localStorage.getItem('selectedRegion');
    if (!selectedRegion) {
        document.getElementById('loading-screen').style.display = 'none';
        Core.DrawLocationSelectionMenu();
        return;
    }
    document.getElementById('loading-screen').style.display = '';
    Core.SetUrls(selectedRegion);
    await Core.GetSettings();
    Socket.PrepareWebsocketCommunication();
    Chat.PrepareWebsocketCommunication();
    Core.PrepareMapContainer();
    Core.PrepareTextureLoader();
    Core.PrepareMapWrap();
    Core.PrepareWeatherWrap();
    Core.DrawOutterLink();
    Core.DrawUsersCountDom();
    Chat.DrawChatUI();
    AddDragMapEvent();
    Core.AddEvents();
    Core.PrepareMapCanvas();
    Core.PrepareWebGlDom();
    Core.PrepareWeatherCanvas();
    Core.PrepareImageSources();
    Core.UpdatePlantProceedAccelerated();
    Core.ApplyWeather();

    // // 텍스처 워커 생성 (수정된 KTX2 Worker)
    // const USE_PNG = false;  // KTX2 사용
    
    // if (USE_PNG) {
    //     console.log('🔧 Creating texture worker with PNG fallback...');
    //     window.textureWorker = new Worker('/js/pngWorker.js');
    // } else {
    //     console.log('🔧 Creating texture worker with fixed KTX2...');
    //     window.textureWorker = new Worker('/js/finalKtx2Worker.js');
    // }
    
    // // Worker 에러 핸들링
    // window.textureWorker.addEventListener('error', (error) => {
    //     console.error('❌ Worker error:', error);
    // });
    
    // // Worker 초기화 상태 확인
    // window.textureWorker.addEventListener('message', (e) => {
    //     console.log('📨 Worker message:', e.data.type, e.data);
    //     if (e.data.type === 'ready') {
    //         console.log('✅ Texture worker is ready');
    //     } else if (e.data.type === 'initialized') {
    //         console.log('✅ Texture worker Basis initialized');
    //     } else if (e.data.type === 'error') {
    //         console.error('❌ Texture worker error:', e.data.error);
    //     }
    // });
    
    // WebGPU 지원 확인
    if (!navigator.gpu) {
        alert('WebGPU is needed !');
    } else {
        // WebGPU 컨트롤러 생성
        console.log('🚀 Initializing WebGPU Controller...');
        window.webGPUController = await WebGPUController.create(
            document.getElementById('webGlDom'),
            TWEEN,
            null
        );
        console.log('✅ WebGPU Controller initialized successfully');
    }
}
window.onresize = function () {
    Core.DrawMap(true, false, false);
}