'use strict';
const Chat = {
    WebsocketConnection: null,
    GetUsersCountTimeout: null,
    PrepareWebsocketCommunication: () => {
        Chat.WebsocketConnection = new signalR.HubConnectionBuilder().withUrl(Variables.ChatUrl+"/chatHub").build();
        Chat.WebsocketConnection.start().then(function () {
            console.log("Chat connection started.");
        }).catch(function (err) {
            return console.error(err.toString());
        });
        Chat.WebsocketConnection.on("ReceiveMessage", function (user, message) {
            console.log(user, message);
        });
        Chat.WebsocketConnection.on("ReceiveConnectedUserCount", function (count) {
            const targetDom = document.getElementById("connectedUserCountSpan");
            if(targetDom == null) { return; }
            targetDom.innerHTML = count;
        });
        Chat.WebsocketConnection.on("WebsocketConnected", function () {
            Chat.GetConnectedUserCount();
        });
        Chat.WebsocketConnection.on("WebsocketDisconnected", function () {
            console.log("WebsocketDisconnected");
        });
    },
    SendMessageViaWebsocket: (user, message) => {
        Chat.WebsocketConnection.invoke("SendMessage", user, message).catch(function (err) {
            return console.error(err.toString());
        });
    },
    GetConnectedUserCount: () => {
        clearTimeout(Chat.GetUsersCountTimeout);
        Chat.WebsocketConnection.invoke("GetConnectedUserCount").catch(function (err) {
            const targetDom = document.getElementById("connectedUserCountSpan");
            if (targetDom == null) { return; }
            targetDom.innerHTML = `
            <img src="/img/refresh-svgrepo-com.svg" 
                alt="Refresh Icon" 
                style="width: 32px; height: 32px; vertical-align: middle; cursor: pointer;" 
                onclick="location.reload();" />
            `;
            console.error(err.toString());
        });
        Chat.GetUsersCountTimeout = setTimeout(() => {
            Chat.GetConnectedUserCount();
        }, 1000);
    },
};