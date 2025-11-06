// /js/index.js
'use strict';
import * as TWEEN from 'https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@20.0.3/dist/tween.esm.js';
import { WebGLManager } from './webglManager.js';

window.onload = async function () {
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
    
    // WebGL DOM 준비
    Core.PrepareWebGlDom();
    
    // ✅ WebGL 초기화 (간단하게)
    await initWebGL();
    
    Core.PrepareWeatherCanvas();
    Core.PrepareImageSources();
    Core.UpdatePlantProceedAccelerated();
    Core.ApplyWeather();
    
    // ✅ TWEEN 업데이트 루프 (WebGL과 별도)
    startTweenLoop();
}

// ✅ WebGL 초기화 (글루 코드만)
async function initWebGL() {
    try {
        console.log('🚀 Starting WebGL initialization...');
        
        // Canvas 가져오기
        const canvas = Variables.Doms.get('webGlCanvas');
        if (!canvas) {
            throw new Error('Canvas not found! Make sure Core.PrepareWebGlDom() was called.');
        }
        
        // WebGLManager 생성 및 초기화
        window.webglManager = new WebGLManager(canvas);
        await window.webglManager.init();
        
        // 샘플 로드 제거됨 - 실제 사용 시 필요한 텍스처만 로드
        // 테스트용: 콘솔에서 window.webglManager.applyScale(8) 등으로 테스트 가능
        
        // ✅ 렌더링 루프 시작 (WebGLManager가 알아서 처리)
        window.webglManager.startRenderLoop();
        
        console.log('✅ WebGL initialization complete!');

        // WebGL 초기화 완료 후 메모리 모니터 자동 시작
        window.webglManager.createMemoryMonitor();
        
    } catch (error) {
        console.error('❌ WebGL initialization failed:', error);
        alert('WebGL 초기화 실패: ' + error.message);
    }
}

// ✅ TWEEN 업데이트 루프 (기존 로직 유지)
function startTweenLoop() {
    function loop(timestamp) {
        TWEEN.update(timestamp);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

window.onresize = function () {
    Core.DrawMap(true, false, false);
    
    // ✅ WebGL 리사이즈 (WebGLManager 메서드 호출)
    if (window.webglManager) {
        const container = Variables.Doms.get('webGlDom');
        window.webglManager.resize(container.clientWidth, container.clientHeight);
    }
}