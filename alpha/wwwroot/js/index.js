'use strict';
window.onload = async function () {
    const urlParams = new URLSearchParams(window.location.search);
    Variables.ApiUrl = urlParams.get('api') || 'https://api.breathingworld.com';
    Variables.ChatUrl = urlParams.get('chat') || 'https://chat.breathingworld.com';

    await Core.GetSettings();
    Socket.PrepareWebsocketCommunication();
    Chat.PrepareWebsocketCommunication();
    Core.PrepareMapWrap();
    AddDragMapEvent();
    Core.AddEvents();
    Core.PrepareCanvas();
    Core.PrepareImageSources();
}
window.onresize = function () {
    Core.DrawMap(true, false);
}