'use strict';
window.onload = async function () {
    const urlParams = new URLSearchParams(window.location.search);
    Variables.ApiUrl = urlParams.get('api') || 'https://api.breathingworld.com';
    Variables.SocketUrl = urlParams.get('socket') || 'https://api.breathingworld.com';

    const origin = window.location.origin;
    if (origin === "https://us-alpha.breathingworld.com") { Variables.SocketUrl = "https://us-api.breathingworld.com"; }
    else if (origin === "https://eu-alpha.breathingworld.com") { Variables.SocketUrl = "https://eu-api.breathingworld.com"; }
    else if (origin === "https://ap-alpha.breathingworld.com") { Variables.SocketUrl = "https://ap-api.breathingworld.com"; }

    Variables.ChatUrl = urlParams.get('chat') || 'https://chat.breathingworld.com';

    await Core.GetSettings();
    Socket.PrepareWebsocketCommunication();
    Chat.PrepareWebsocketCommunication();
    Core.PrepareMapWrap();
    AddDragMapEvent();
    Core.AddEvents();
    Core.PrepareCanvas();
    Core.PrepareImageSources();
    Core.UpdatePlantProceedAccelerated();
}
window.onresize = function () {
    Core.DrawMap(true, false);
}