'use strict';
// import * as TWEEN from 'https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@20.0.3/dist/tween.esm.js';
// import { PixiController } from '/js/pixiController.js';
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
    Core.PrepareMapWrap();
    Core.PrepareWeatherWrap();
    Core.DrawOutterLink();
    Core.DrawUsersCountDom();
    Chat.DrawChatUI();

    Core.PrepareMapCanvas();
    LeafLet.Init();

    Core.PrepareWebGlDom();
    Core.PrepareImageSources();
    Core.UpdatePlantProceedAccelerated();
    // Core.ApplyWeather();

    // window.textureWorker = new Worker('/js/textureWorker.js', { type: 'module' });
    // window.pixiController = await PixiController.create(document.getElementById('webGlDom'), TWEEN, window.textureWorker);
}