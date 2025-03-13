'use strict';
const Chat = {
    WebsocketConnection: null,
    GetUsersCountTimeout: null,
    modalDom: null,
    chatVisible: false,
    newMessageReceived: false,
    
    PrepareWebsocketCommunication: () => {
        Chat.WebsocketConnection = new signalR.HubConnectionBuilder().withUrl(Variables.ChatUrl + "/chatHub").build();
        Chat.WebsocketConnection.start().then(function () {
            console.log("Chat connection started.");
        }).catch(function (err) {
            return console.error(err.toString());
        });

        Chat.WebsocketConnection.on("ReceiveMessage", function (user, message) {
            Chat.ReceiveMessageHandler(user, message);
        });

        Chat.WebsocketConnection.on("ReceiveConnectedUserCount", function (count) {
            const targetDom = document.getElementById("connectedUserCountSpan");
            if (targetDom == null) { return; }
            targetDom.innerHTML = count;
        });

        Chat.WebsocketConnection.on("WebsocketConnected", function () {
            Chat.GetConnectedUserCount();
        });

        Chat.WebsocketConnection.on("ReceiveInvalidUserName", function () {
            Chat.ShowModal("Invalid user name. Please enter a valid name.");
        });

        Chat.WebsocketConnection.on("ReceiveInvalidMessage", function () {
            Chat.ShowModal("Invalid message. Please enter a valid message.");
        });

        Chat.WebsocketConnection.on("WebsocketDisconnected", function () {
            console.log("WebsocketDisconnected");
        });
    },

    DrawChatUI: () => {
        const chatLogContainer = document.createElement('div');
        chatLogContainer.id = 'chat_log_container';
        chatLogContainer.style.position = 'fixed';
        chatLogContainer.style.right = '8px';
        chatLogContainer.style.bottom = '41px';
        chatLogContainer.style.width = '302px';
        chatLogContainer.style.height = '150px';
        chatLogContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        chatLogContainer.style.borderTopLeftRadius = '10px';
        chatLogContainer.style.borderTopRightRadius = '10px';
        chatLogContainer.style.display = 'none';
        chatLogContainer.style.flexDirection = 'column';
        chatLogContainer.style.padding = '0';

        const chatLogDom = document.createElement('div');
        chatLogDom.id = 'chat_log';
        chatLogDom.style.flex = '1';
        chatLogDom.style.overflowY = 'scroll';
        chatLogDom.style.padding = '10px';
        chatLogDom.style.color = '#FFF';
        chatLogDom.style.whiteSpace = 'pre-wrap';
        chatLogDom.style.scrollbarWidth = 'thin';
        chatLogDom.style.scrollbarColor = '#888 transparent';

        const style = document.createElement('style');
        style.innerHTML = `
            #chat_log::-webkit-scrollbar {
                width: 6px;
            }
            #chat_log::-webkit-scrollbar-thumb {
                background-color: #888;
                border-radius: 10px;
            }
            #chat_log::-webkit-scrollbar-thumb:hover {
                background-color: #555;
            }
            #chat_log::-webkit-scrollbar-track {
                background: transparent;
            }
        `;
        document.head.appendChild(style);

        const closeChatLayer = document.createElement('div');
        closeChatLayer.style.position = 'absolute';
        closeChatLayer.style.top = '0';
        closeChatLayer.style.right = '0';
        closeChatLayer.style.width = '40px';
        closeChatLayer.style.height = '40px';
        closeChatLayer.style.background = 'transparent';

        const closeChatBtn = document.createElement('button');
        closeChatBtn.id = 'close_chat_btn';
        closeChatBtn.style.position = 'absolute';
        closeChatBtn.style.top = '5px';
        closeChatBtn.style.right = '5px';
        closeChatBtn.style.background = 'transparent';
        closeChatBtn.style.color = '#FFF';
        closeChatBtn.style.border = 'none';
        closeChatBtn.style.fontSize = '16px';
        closeChatBtn.style.cursor = 'pointer';
        closeChatBtn.innerHTML = '✖';

        closeChatBtn.addEventListener('click', () => {
            Chat.toggleChatVisibility();
        });

        closeChatLayer.appendChild(closeChatBtn);

        chatLogContainer.appendChild(chatLogDom);
        chatLogContainer.appendChild(closeChatLayer);

        const chatInputDom = document.createElement('div');
        chatInputDom.id = 'chat_input';
        chatInputDom.style.position = 'fixed';
        chatInputDom.style.right = '8px';
        chatInputDom.style.bottom = '10px';
        chatInputDom.style.width = '302px';
        chatInputDom.style.display = 'none';
        chatInputDom.style.alignItems = 'center';

        let html = '';
        html += '<input type="text" id="chat_username" placeholder="Your name" style="flex: 0 0 75px; padding: 8px; border: none; border-right: 1px solid #ddd; border-bottom-left-radius: 5px; min-width: 0;" />';
        html += '<input type="text" id="chat_message" placeholder="Type a message and enter" style="flex: 1 1 auto; padding: 8px; border: none; border-bottom-right-radius: 5px; min-width: 0;" />';
        
        chatInputDom.innerHTML = html;

        const chatToggleIcon = document.createElement('div');
        chatToggleIcon.id = 'chat_toggle_icon';
        chatToggleIcon.style.position = 'fixed';
        chatToggleIcon.style.right = '20px';
        chatToggleIcon.style.bottom = '13px';
        chatToggleIcon.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        chatToggleIcon.style.borderRadius = '50%';
        chatToggleIcon.style.display = 'flex';
        chatToggleIcon.style.justifyContent = 'center';
        chatToggleIcon.style.alignItems = 'center';
        chatToggleIcon.style.cursor = 'pointer';
        chatToggleIcon.innerHTML = '<img id="chatToggleIconImage" src="' + window.cdnPrefix + '/img/chat-round-dots-svgrepo-com-empty.svg" alt="Chat" style="width: 32px; height: 32px; filter: drop-shadow(2px 2px 5px rgba(255, 255, 255, 0.8));" />';
        
        chatToggleIcon.addEventListener('click', () => {
            Chat.toggleChatVisibility();
            if (Chat.newMessageReceived) {
                Chat.clearNotification();
            }
        });

        document.body.appendChild(chatLogContainer);
        document.body.appendChild(chatInputDom);
        document.body.appendChild(chatToggleIcon);

        document.getElementById('chat_message').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const user = document.getElementById('chat_username').value;
                const message = document.getElementById('chat_message').value;

                if (user.trim() !== '' && message.trim() !== '') {
                    Chat.SendMessage(user, message);
                    document.getElementById('chat_message').value = '';
                }
            }
        });
    },

    toggleChatVisibility: () => {
        const chatLogContainer = document.getElementById('chat_log_container');
        const chatInputDom = document.getElementById('chat_input');
        const chatToggleIcon = document.getElementById('chat_toggle_icon');

        if (Chat.chatVisible) {
            chatLogContainer.style.display = 'none';
            chatInputDom.style.display = 'none';
            chatToggleIcon.style.display = 'flex';
        } else {
            chatLogContainer.style.display = 'flex';
            chatInputDom.style.display = 'flex';
            chatToggleIcon.style.display = 'none';
        }

        Chat.chatVisible = !Chat.chatVisible;
    },

    markNewMessage: () => {
        document.getElementById('chatToggleIconImage').src = window.cdnPrefix + '/img/chat-round-dots-svgrepo-com-new.svg';
        Chat.newMessageReceived = true;
    },

    clearNotification: () => {
        document.getElementById('chatToggleIconImage').src = window.cdnPrefix + '/img/chat-round-dots-svgrepo-com-empty.svg';
        Chat.newMessageReceived = false;
    },

    SendMessage: (user, message) => {
        Chat.WebsocketConnection.invoke("SendMessage", user, message).catch(function (err) {
            return console.error(err.toString());
        });
    },

    ShowModal: (message) => {
        let modalBackground = document.getElementById('modal_background');
        if (!modalBackground) {
            modalBackground = document.createElement('div');
            modalBackground.id = 'modal_background';
            modalBackground.style.position = 'fixed';
            modalBackground.style.top = '0';
            modalBackground.style.left = '0';
            modalBackground.style.width = '100vw';
            modalBackground.style.height = '100vh';
            modalBackground.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            modalBackground.style.display = 'flex';
            modalBackground.style.alignItems = 'center';
            modalBackground.style.justifyContent = 'center';
            modalBackground.style.zIndex = '999';
            document.body.appendChild(modalBackground);
        }
        let modal = document.getElementById('modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal';
            modal.style.backgroundColor = '#FFF';
            modal.style.padding = '20px';
            modal.style.borderRadius = '10px';
            modal.style.textAlign = 'center';
            modal.style.width = '300px';
            modal.style.fontFamily = 'Arial, Helvetica, sans-serif';
            modal.style.fontSize = '16px';
            modal.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
            modalBackground.appendChild(modal);
        }
        modal.innerHTML = `
            <p style="margin-bottom: 20px;">${message}</p>
            <button id="modal_close" style="padding: 8px 16px; background-color: #4CAF50; color: #FFF; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">Close</button>
        `;
        document.getElementById('modal_close').addEventListener('click', () => {
            modalBackground.remove();
        });
    },

    ReceiveMessageHandler: (user, message) => {
        const chatLogDom = document.getElementById('chat_log');
        if (chatLogDom) {
            const messageDom = document.createElement('div');
            messageDom.innerHTML = `<strong>${user}:</strong> ${message}`;
            messageDom.style.marginBottom = '5px';
            chatLogDom.appendChild(messageDom);
            chatLogDom.scrollTop = chatLogDom.scrollHeight;

            if (!Chat.chatVisible) {
                Chat.markNewMessage();
            }
        }
    },

    GetConnectedUserCount: () => {
        clearTimeout(Chat.GetUsersCountTimeout);
        if(Chat.WebsocketConnection == null) {
            Chat.ShowRefreshIcon();
            return;
        }
        Chat.WebsocketConnection.invoke("GetConnectedUserCount").catch(function (err) {
            Chat.ShowRefreshIcon();
            console.error(err.toString());
        });
        Chat.GetUsersCountTimeout = setTimeout(() => {
            Chat.GetConnectedUserCount();
        }, 1000);
    },
    ShowRefreshIcon: () => {
        clearTimeout(Chat.GetUsersCountTimeout);
        const targetDom = document.getElementById("connectedUserCountSpan");
        if (targetDom == null) { return; }
        targetDom.innerHTML = `
            <img src="` + window.cdnPrefix + `/img/refresh-svgrepo-com.svg" 
                alt="Refresh Icon" 
                style="width: 32px; height: 32px; vertical-align: middle; cursor: pointer;" 
                onclick="location.reload();" />
        `;
        Chat.ShowReconnectModal();
    },
    ShowReconnectModal() {
        const loadingScreen = document.getElementById('loading-screen');
        if(loadingScreen != null) { loadingScreen.style.display = 'none'; }
        const modalId = 'modal';
        let modal = document.getElementById(modalId);
        if(modal == null) {
            modal = document.createElement('div');
            modal.id = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `<div class="modal-content"><img src="/img/icon-shadow-550x550.png" alt="사이트 아이콘" class="reconnectIcon"><p>Hello! The connection was briefly interrupted.<br>Don't worry, I'll reconnect you!</p><button id="reconnectBtn">Connect</button></div>`;
            document.body.appendChild(modal);
            const reconnectBtn = document.getElementById('reconnectBtn');
            reconnectBtn.addEventListener('click', function() {
                location.reload();
            });
        }
    }
};
