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
    Core.PrepareMapWrap();
    Core.PrepareCanvas();
    Core.PrepareImageSources();
    Core.UpdatePlantProceedAccelerated();
    MapControl.Prepare();
    // AddDragMapEvent();
    // Core.AddEvents();
}
window.onresize = function () {
    Core.DrawMap(true, false);
}