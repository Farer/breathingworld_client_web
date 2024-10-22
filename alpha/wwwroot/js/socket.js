'use strict';
const Socket = {
    WebsocketConnection: null,
    PrepareWebsocketCommunication: () => {
        Socket.WebsocketConnection = new signalR.HubConnectionBuilder().withUrl(Variables.ApiUrl+"/nodeHub").build();
        Socket.WebsocketConnection.start().then(function () {
            console.log("SignalR connection started.");
            Socket.SendMessageViaWebsocket('Welcome', 'to Breathing World!');
            Socket.UnjoinMapGroup();
        }).catch(function (err) {
            return console.error(err.toString());
        });
        Socket.WebsocketConnection.on("ReceiveMessage", function (user, message) {
            console.log(user, message);
            console.log('Are you a developer ? 😁');
            Socket.GetConnectedUserCount();
        });
        Socket.WebsocketConnection.on("ReceiveConnectedUserCount", function (count) {
            const targetDom = document.getElementById("connectedUserCountSpan");
            if(targetDom == null) { return; }
            targetDom.innerHTML = count;
        });
        Socket.WebsocketConnection.on("WebsocketDisconnected", function () {
            console.log("WebsocketDisconnected");
        });
        Socket.WebsocketConnection.on("ReceiveMapImageUpdateId", function (mapImageUpdateId) {
            try {
                Variables.Settings.mapImageUpdateId = mapImageUpdateId;
                const randomNumber = Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000;
                clearTimeout(Variables.TimeoutInfo.updateMapImageUpdateId);
                Variables.TimeoutInfo.updateMapImageUpdateId = setTimeout(function () {
                    Images.Data.environmentMap.src = Variables.ApiUrl+'/maps/'+Variables.Settings.mapId+'/live/'+mapImageUpdateId;
                }, randomNumber);
            } catch (error) {
                console.error(error);
            }
        });
        Socket.WebsocketConnection.on("ReceiveOneWeedInfo", function (districtId, tileId, weedProceedCode, fecesExists) {
            try {
                if(Data.Weed.DistrictData[districtId] == undefined) {
                    Animal.RemoveWeedAfterEating(tileId, districtId);
                    return;
                }
                if(Data.Weed.DistrictData[districtId][tileId] != undefined) {
                    if(Variables.Settings.weedProceedCode[weedProceedCode] == 'none') {
                        Data.Weed.DistrictData[districtId][tileId] = [-1, fecesExists];
                        Animal.RemoveWeedAfterEating(tileId, districtId);
                    }
                    else if(weedProceedCode == -1) {
                        Animal.RemoveWeedAfterEating(tileId, districtId);
                    }
                    else {
                        Data.Weed.DistrictData[districtId][tileId] = [weedProceedCode, fecesExists];
                        Core.UpdateOneWeedTile(districtId, tileId);
                    }
                }
            } catch (error) {
                console.error(error);
            }
        });
        Socket.WebsocketConnection.on("ReceiveWeedInfoByDistrictId", function (districtId, weedsBytes) {
            try {
                const nowDate = Date.now();

                const base64Data = weedsBytes;
                const decodedData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const weedInfoDecoded = msgpack.decode(decodedData);
                if (Object.keys(weedInfoDecoded).length === 0) {
                    Methods.GetDistrictDataOneByOneByFromBucket();
                    return;
                }
                Data.Weed.DistrictDataUpdateTime[districtId] = nowDate;
                Data.Weed.DistrictData[districtId] = weedInfoDecoded;
            
                Core.DrawDistrictWeedTileByDistrictId(districtId);
                Methods.GetDistrictDataOneByOneByFromBucket();
            } catch (error) {
                console.error(error);
            }
        });
        Socket.WebsocketConnection.on("ReceiveOneRabbitInfoByDistrict", function (rabbitId, rabbitBytes) {
            try {
                if(rabbitBytes == null) {
                    Animal.RemoveDom('rabbit', rabbitId);
                }
                else {
                    const rabbitInfo = Animal.DecodeRabbitBytes(rabbitBytes);
                    Animal.DrawDom('rabbit', rabbitInfo);
                }
            } catch (error) {
                console.error(error);
            }
        });
        
        Socket.WebsocketConnection.on("ReceiveRabbitInfoByDistrictId", function (districtId, rabbitsBytes) {
            try {
                if (rabbitsBytes.length > 0) {
                    for (let i in rabbitsBytes) {
                        const rabbitInfo = Animal.DecodeRabbitBytes(rabbitsBytes[i]);
                        Animal.DrawDom('rabbit', rabbitInfo);
                    }
                }
            } catch (error) {
                console.error(error);
            }
        });

        Socket.WebsocketConnection.on("ReceiveAddedFertilizerByDistrict", function (districtId, tileId) {
            try {
                Core.UpdateOneWeedTileByFeces(districtId, tileId, true);
            } catch (error) {
                console.error(error);
            }
        });
        Socket.WebsocketConnection.on("ReceiveRemovedFertilizerByDistrict", function (districtId, tileId) {
            try {
                Core.UpdateOneWeedTileByFeces(districtId, tileId, false);
            } catch (error) {
                console.error(error);
            }
        });
    },
    SendMessageViaWebsocket: (user, message) => {
        Socket.WebsocketConnection.invoke("SendMessage", user, message).catch(function (err) {
            return console.error(err.toString());
        });
    },
    GetConnectedUserCount: () => {
        Socket.WebsocketConnection.invoke("GetConnectedUserCount").catch(function (err) {
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
        setTimeout(() => {
            Socket.GetConnectedUserCount();
        }, 1000);
    },
    UnjoinMapGroup: () => {
        if(Variables.MapScaleInfo.current > 4) {
            Variables.MapInfo.viewDistrictIds = Methods.GatherViewDistrictIds();
        }
        else if(Variables.MapInfo.viewDistrictIds.length > 0) {
            Variables.MapInfo.viewDistrictIds = [];
            Methods.RemoveWeedWrapDom();
            Methods.RemoveAnimalWrapDom();
        }
        else if(Variables.MapInfo.viewDistrictIds.length == 0) {
            return;
        }
        Socket.WebsocketConnection.invoke("UnjoinMapGroup")
        .then(function () {
            if(Variables.MapInfo.viewDistrictIds.length > 0) {
                Socket.JoinMapGroup(Variables.MapInfo.viewDistrictIds);
            }
        })
        .catch(function (err) {
            return console.error(err.toString());
        });
    },
    JoinMapGroup: (mapIds) => {
        let targetIds = [];
        for(let i=0; i<mapIds.length; i++) {
            targetIds.push(mapIds[i].toString());
        }
        Socket.WebsocketConnection.invoke("JoinMapGroup", targetIds)
        .then(function () {
            Methods.PrepareDistrictIdsToGet();
            if(Data.Weed.UserPaused == false && Variables.UserDragged == true) { return; }
            Methods.CleanPrepareWeedWrapDom();
            Methods.CleanPrepareAnimalWrapDom();
            Methods.GetDistrictDataOneByOneByFromBucket();
        })
        .catch(function (err) {
            return console.error(err.toString());
        });
    },
    GetWeedInfoByDistrictId: (districtId) => {
        
        if(Methods.IfDistrictWeedCacheValid(districtId)) {
            Core.DrawDistrictWeedTileByDistrictId(districtId);
            Methods.GetDistrictDataOneByOneByFromBucket();
            return;
        }
        Socket.WebsocketConnection.invoke("GetWeedInfoByDistrictId", districtId).catch(function (err) {
            return console.error(err.toString());
        });
    },
    GetRabbitInfoByDistrictId: (districtId) => {
        Socket.WebsocketConnection.invoke("GetRabbitInfoByDistrictId", districtId).catch(function (err) {
            return console.error(err.toString());
        });
    },
};