'use strict';
import { PixiController } from './pixiController.js';
import * as TWEEN from 'https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@20.0.3/dist/tween.esm.js';

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
        // 1. Worker 생성
        worker = new Worker('./js/textureWorker.js');

        // 2. PixiController 생성
        // ✅ window.TWEEN 대신 import한 TWEEN 객체를 직접 전달
        controller = await PixiController.create(document.body, TWEEN, worker);

        // 3. 뷰 상태 설정
        if (initData.viewState) {
            controller.updateViewState(initData.viewState);
        }

        // 4. 에셋 로드 및 생태계 구성
        if (controller.pixiManager) {
            const currentScale = initData.scale || 1;
            await controller.pixiManager.applyScale(currentScale);
            
            if (typeof controller.populateNewEntities === 'function') {
                controller.populateNewEntities();
            }
        }

        window.parent.postMessage({ type: 'WORLD_READY' }, '*');

    } catch (err) {
        console.error('❌ Breathing World Init Failed:', err);
        window.parent.postMessage({ type: 'WORLD_ERROR', message: err.message }, '*');
    }
}

window.addEventListener('resize', () => {
    if (controller && controller.pixiManager && controller.pixiManager.app) {
        controller.pixiManager.app.resize();
    }
});