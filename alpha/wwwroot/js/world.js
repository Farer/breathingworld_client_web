// [js/world.js]

import { PixiController } from './pixiController.js';
import * as TWEEN from 'https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@20.0.3/dist/tween.esm.js';
import { Variables } from './worldVariables.js';

// 소켓 통신을 위한 모듈이 있다면 여기서 import 하거나 전역 객체를 사용해야 합니다.
// import { Socket } from './socket.js'; // (예시) 필요한 경우 주석 해제

let controller = null;
let worker = null;

window.addEventListener('message', async (event) => {
    const data = event.data;
    if (!data) return;

    switch (data.type) {
        case 'INIT':
            await initializeWorld(data);
            break;

        case 'SYNC_POSITION':
            if (controller) {
                // 좌표 동기화 및 구역 재계산 요청
                controller.updateViewState(data.viewState);
            }
            break;

        case 'PAUSE':
            if (controller) controller.pause();
            break;
        case 'RESUME':
            if (controller) controller.resume();
            break;
    }
});

async function initializeWorld(initData) {
    try {
        worker = new Worker('./js/textureWorker.js');
        
        controller = await PixiController.create(document.body, TWEEN, worker);

        // 초기 뷰 상태 설정 및 구역 계산
        if (initData.viewState) {
            controller.updateViewState(initData.viewState);
        }

        // 초기 스케일 적용 (Pre-load)
        if (controller.pixiManager) {
            const currentScale = initData.scale || 1;
            await controller.pixiManager.applyScale(currentScale);
            
            // 초기 데이터 로드 (첫 구역 계산 후 실행됨)
            // controller.populateNewEntities(); 
        }

        window.parent.postMessage({ type: 'WORLD_READY' }, '*');

    } catch (err) {
        console.error('❌ Breathing World Init Failed:', err);
        window.parent.postMessage({ type: 'WORLD_ERROR', message: err.message }, '*');
    }
}

window.addEventListener('resize', () => {
    if (controller && controller.pixiManager?.app) {
        controller.pixiManager.app.resize();
        // 리사이즈 시 보이는 구역이 달라질 수 있으므로 재계산 필요할 수 있음
        if(controller) controller.calculateAndFetchDistricts();
    }
});