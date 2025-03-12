'use strict';
const Socket = {
    WebsocketConnection: null,
    PrepareWebsocketCommunication: () => {
        Socket.WebsocketConnection = new signalR.HubConnectionBuilder().withUrl(Variables.SocketUrl+"/nodeHub").build();
        Socket.WebsocketConnection.start().then(function () {
            console.log("Datahub connection started.");
            Socket.SendMessage('Welcome', 'to Breathing World!');
            Socket.UnjoinMapGroup();
        }).catch(function (err) {
            return console.error(err.toString());
        });
        Socket.WebsocketConnection.on("ReceiveMessage", function (user, message) {
            console.log(user, message);
            console.log('Are you a developer ? 😁');
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
        Socket.WebsocketConnection.on("ReceivePlantProceedAccelerated", function (plantProceedAccelerated) {
            try {
                Variables.Settings.plantProceedAccelerated = plantProceedAccelerated;
                Core.UpdatePlantProceedAccelerated();
            } catch (error) {
                console.error(error);
            }
        });
        Socket.WebsocketConnection.on("ReceiveOneWeedInfo", function (districtId, tileId, weedProceedCode, rabbitFeceExists, wolfFeceExists) {
            try {
                if(Data.Weed.DistrictData[districtId] == undefined) {
                    Animal.RemoveWeedAfterEating(tileId, districtId);
                    return;
                }
                if(Data.Weed.DistrictData[districtId][tileId] != undefined) {
                    if(Variables.Settings.weedProceedCode[weedProceedCode] == 'none') {
                        Data.Weed.DistrictData[districtId][tileId] = -1;
                        Animal.RemoveWeedAfterEating(tileId, districtId);
                    }
                    else if(weedProceedCode == -1) {
                        Animal.RemoveWeedAfterEating(tileId, districtId);
                    }
                    else {
                        Data.Weed.DistrictData[districtId][tileId] = weedProceedCode;
                        if(Data.Feces.DistrictData[districtId] == undefined) {
                            Data.Feces.DistrictData[districtId] = [];
                        }
                        Data.Feces.DistrictData[districtId][tileId] = [rabbitFeceExists, wolfFeceExists];
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
                Data.Weed.DistrictData[districtId] = [];
                for(var i in weedInfoDecoded) {
                    Data.Weed.DistrictData[districtId][i] = weedInfoDecoded[i][0];
                    Methods.UpdateFecesData(districtId, i, [weedInfoDecoded[i][1], weedInfoDecoded[i][2]]);
                }
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
        Socket.WebsocketConnection.on("ReceiveOneWolfInfoByDistrict", function (wolfId, wolfBytes) {
            try {
                if(wolfBytes == null) {
                    Animal.RemoveDom('wolf', wolfId);
                }
                else {
                    const wolfInfo = Animal.DecodeWolfBytes(wolfBytes);
                    Animal.DrawDom('wolf', wolfInfo);
                }
            } catch (error) {
                console.error(error);
            }
        });
        Socket.WebsocketConnection.on("ReceiveWolfInfoByDistrictId", function (districtId, wolvesBytes) {
            try {
                if (wolvesBytes.length > 0) {
                    for (let i in wolvesBytes) {
                        const wolfInfo = Animal.DecodeWolfBytes(wolvesBytes[i]);
                        Animal.DrawDom('wolf', wolfInfo);
                    }
                }
            } catch (error) {
                console.error(error);
            }
        });
        Socket.WebsocketConnection.on("ReceiveTreeInfoByDistrictId", function (districtId, treesBytes) {
            try {
                const nowDate = Date.now();
                const treesIds = [];
                const count = treesBytes.length;
                for (let i=0; i<count; i++) {
                    const treeInfoDecoded = Tree.DecodeTreeBytes(treesBytes[i]);
                    Tree.UpsertData(treeInfoDecoded);
                    treesIds.push(treeInfoDecoded.id);
                }
                if (treesIds.length === 0) {
                    Methods.GetDistrictDataOneByOneByFromBucket();
                    return;
                }
                Data.Tree.DistrictDataUpdateTime[districtId] = nowDate;
                Data.Tree.IdsInDistrict[districtId] = treesIds;
            
                Tree.DrawDistrictTreeTileByDistrictId(districtId);
                Methods.GetDistrictDataOneByOneByFromBucket();
            } catch (error) {
                console.error(error);
            }
        });
        Socket.WebsocketConnection.on("ReceiveOneTreeInfoByDistrict", function (treeId, treesBytes) {
            try {
                if(treesBytes == null) {
                    Tree.RemoveDom(treeId);
                }
                else {
                    const treeInfoDecoded = Tree.DecodeTreeBytes(treesBytes);
                    const treeData = Tree.UpsertData(treeInfoDecoded);
                    const districtId = Methods.DefineDistrictIdByTileId(treeData.centerPositionX, treeData.centerPositionY);
                    Data.Tree.DistrictDataUpdateTime[districtId] = Date.now() - Data.Tree.CacheExpireMillis;
                    Tree.HandleTreeDomByStat(treeData);
                }
            } catch (error) {
                console.error(error);
            }
        });
        Socket.WebsocketConnection.on("ReceiveAddedFecesByDistrict", function (districtId, tileId, kind) {
            try {
                Methods.AddFecesData(districtId, tileId, kind);
                Core.UpdateOneWeedTileByFeces(districtId, tileId, true, kind);
            } catch (error) {
                console.error(error);
            }
        });
        Socket.WebsocketConnection.on("ReceiveRemovedFecesByDistrict", function (districtId, tileId, kind) {
            try {
                Methods.RemoveFecesData(districtId, tileId, kind);
                Core.UpdateOneWeedTileByFeces(districtId, tileId, false, kind);
            } catch (error) {
                console.error(error);
            }
        });
    },
    SendMessage: (user, message) => {
        Socket.WebsocketConnection.invoke("SendMessage", user, message).catch(function (err) {
            return console.error(err.toString());
        });
    },
    UnjoinMapGroup: () => {
        if(Variables.MapScaleInfo.current > 4) {
            Variables.MapInfo.viewDistrictIds = Methods.GatherViewDistrictIds();
        }
        else if(Variables.MapInfo.viewDistrictIds.length > 0) {
            Variables.MapInfo.viewDistrictIds = [];
            Methods.RemoveWeedWrapDom();
            Methods.RemoveTreeWrapDom();
            Methods.RemoveAnimalWrapDom();
            Methods.RemoveShadowWrapDom();
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
            Chat.ShowRefreshIcon();
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
            Methods.CleanPrepareShadowWrapDom();
            Methods.CleanPrepareAnimalWrapDom();
            Methods.CleanPrepareTreeWrapDom();
            MovementProcess.ResetMovementData();
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
    GetTreeInfoByDistrictId: (districtId) => {
        if(Methods.IfDistrictTreeCacheValid(districtId)) {
            Tree.DrawDistrictTreeTileByDistrictId(districtId);
            Methods.GetDistrictDataOneByOneByFromBucket();
            return;
        }
        Socket.WebsocketConnection.invoke("GetTreeInfoByDistrictId", districtId).catch(function (err) {
            return console.error(err.toString());
        });
    },
    GetRabbitInfoByDistrictId: (districtId) => {
        Socket.WebsocketConnection.invoke("GetRabbitInfoByDistrictId", districtId).catch(function (err) {
            return console.error(err.toString());
        });
    },
    GetWolfInfoByDistrictId: (districtId) => {
        Socket.WebsocketConnection.invoke("GetWolfInfoByDistrictId", districtId).catch(function (err) {
            return console.error(err.toString());
        });
    },
};