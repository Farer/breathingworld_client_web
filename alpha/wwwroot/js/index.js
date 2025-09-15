'use strict';
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
    AddDragMapEvent();
    Core.AddEvents();
    Core.PrepareMapCanvas();
    Core.PrepareWeatherCanvas();
    Core.PrepareImageSources();
    Core.UpdatePlantProceedAccelerated();
}
window.onresize = function () {
    Core.DrawMap(true, false);
}