'use strict';
const Animal = {
    Data: {
        rabbit: [],
        wolf: [],
    },
    DecodeRabbitBytes: (rabbitsBytes) => {
        const base64Data = rabbitsBytes;
        const decodedData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const rabbitInfoArray = msgpack.decode(decodedData);
        return Methods.MapRabbitArrayToObject(rabbitInfoArray);
    },
    DecodeWolfBytes: (wolvesBytes) => {
        const base64Data = wolvesBytes;
        const decodedData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const wolfInfoArray = msgpack.decode(decodedData);
        return Methods.MapWolfArrayToObject(wolfInfoArray);
    },
    RemoveDom: (speciesName, animalId) => {
        const keyId = speciesName + '-' + animalId;
        const animalDom = document.getElementById(keyId);
        if(animalDom != null) {
            animalDom.parentNode.removeChild(animalDom);
        }
    },
    IfTrashAnimalData: (speciesName, data) => {
        if(speciesName == 'rabbit') {
            if (data.updateTimeUnix !== undefined) {
                const now = Math.floor(Date.now() / 1000);
                if (now - data.updateTimeUnix > 60) { return true; }
                else { return false; }
            } 
            else { return false; }
        }
        return false;
    },
    DrawDom: (speciesName, data) => {
        const animalWrapDomId = 'animalWrapDom';
        const animalWrapDom = Variables.Doms.get(animalWrapDomId);
        if(!animalWrapDom) { return; }

        if(Animal.IfTrashAnimalData(speciesName, data)) {
            if(speciesName == 'rabbit') { Socket.FoundTrashDataOfRabbit(data.id); return; }
        }
        if(data.actionId == undefined) { data.actionId = 0; }
        const keyId = speciesName + '-' + data.id;
        let animalDom = document.getElementById(keyId);
        if(animalDom == null) {
            animalDom = document.createElement('div');
            animalDom.id = keyId;
            animalDom.style.position = 'absolute';
            animalWrapDom.appendChild(animalDom);
        }

        Animal.UpsertData(speciesName, data);
        const animalDomInfo = Methods.GetAnimalDomInfo(data.currentPosition, keyId);

        animalDom.style.transformOrigin = 'center center';
        if(data.gender==0) {
            animalDom.style.filter = 'brightness(110%)';
        }
        else {
            animalDom.style.filter = 'brightness(120%)';
        }

        animalDom.style.width = animalDomInfo.size + 'px';
        animalDom.style.height = animalDomInfo.size + 'px';

        // animalDom.style.left = animalDomInfo.left + 'px';
        // animalDom.style.top = animalDomInfo.top + 'px';
        DomControll.ApplyTransform(animalDom, 'translate3d', animalDomInfo.left + 'px, ' + animalDomInfo.top + 'px, 0px');

        let currentActionStatus = '';
        let ifShowMoving = false;

        // Rabbit
        if(speciesName == 'rabbit') {
            currentActionStatus = Variables.Settings.rabbitActionStatus[data.actionId];

            Animal.Data.rabbit[keyId].width = animalDomInfo.size;
            Animal.Data.rabbit[keyId].height = animalDomInfo.size;
            Animal.Data.rabbit[keyId].left = animalDomInfo.left;
            Animal.Data.rabbit[keyId].top = animalDomInfo.top;

            if(data.movedTileIds.length > 0) { ifShowMoving = true; }

            const backgroundImageWidth = Sprites.Rabbit.width / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            const backgroundImageHeight = Sprites.Rabbit.height / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            
            if(currentActionStatus =='dead' && ifShowMoving == false) {
                AnimationProcess.RemoveTargetDomId(keyId);
                ShadowControll.RemoveShadow(keyId);
                const boneSize = animalDomInfo.size / 2;
                animalDom.style.background = '';
                animalDom.style.textAlign = 'center';

                const newImg = document.createElement("img");
                newImg.style.position = "absolute";
                newImg.src = Images.Data.animal_bones.src;
                newImg.width = boneSize;
                newImg.height = boneSize;
                // newImg.style.left = "50%";
                // newImg.style.top = "50%";
                // newImg.style.transform = "translate(-50%, -50%)";
                DomControll.ApplyTransform(newImg, 'translate', '-50%, -50%');
                DomControll.ApplyTransform(newImg, 'translate3d', '50%, 50%, 0px');
                const oldImg = animalDom.querySelector("img");
                if (oldImg) { animalDom.replaceChild(newImg, oldImg); }
                else { animalDom.appendChild(newImg); }

                if(animalWrapDom.firstChild != null) { animalWrapDom.insertBefore(animalDom, animalWrapDom.firstChild); }
                MovementProcess.RemoveTargetDomId(keyId);
            }
            else {
                let backgroundPosX = 0;
                if(data.actionId > 5) {
                    backgroundPosX = (data.actionId - 6) * Sprites.Rabbit.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
                }
                const backgroundPosY = 0;
                animalDom.style.overflow = 'hidden';
                animalDom.style.background = 'transparent url("'+Images.Data.rabbit_etc.src+'") no-repeat -' + backgroundPosX + 'px -' + backgroundPosY + 'px / '+backgroundImageWidth+'px '+backgroundImageHeight+'px';
                ShadowControll.CreateShadow(keyId);
            }
                
            

            if(ifShowMoving) {
                const backgroundPosX = 0;
                const backgroundPosY = Animal.GetBackgroundYPositionByStatus(speciesName, 1);
                animalDom.style.background = 'transparent url("'+Images.Data.rabbit.src+'") no-repeat -' + backgroundPosX + 'px -' + backgroundPosY + 'px / '+backgroundImageWidth+'px '+backgroundImageHeight+'px';

                Animal.Data.rabbit[keyId].currentActionFrameCount = Sprites.Rabbit.frameCounts[1];
                const frameDelay = Animal.CalculateWalkingAnimationFrameDelay(speciesName, data.movedTileIds.length);
                Animal.Data.rabbit[keyId].currentActionFrameDelay = frameDelay;
                Animal.StartAnimation(speciesName, data.id, 1);
            }
            else if(
                Variables.Settings.rabbitActionStatus[data.actionId]=='mating' ||
                Variables.Settings.rabbitActionStatus[data.actionId]=='pregnant' ||
                Variables.Settings.rabbitActionStatus[data.actionId]=='breeding'
            ) {
                if(Variables.Settings.rabbitActionStatus[data.actionId]=='pregnant') {
                    animalDom.style.filter = 'brightness(110%)';
                }
                else {
                    animalDom.style.filter = 'brightness(100%)';
                }
                Animal.DrawEtcBackground(keyId, data.actionId);
            }
            else if(Variables.Settings.rabbitActionStatus[data.actionId]!='dead') {
                Animal.Data.rabbit[keyId].currentActionFrameCount = Sprites.Rabbit.frameCounts[data.actionId];
                Animal.Data.rabbit[keyId].currentActionFrameDelay = Sprites.Rabbit.frameDelay[data.actionId];
                const backgroundPosX = 0;
                const backgroundPosY = Animal.GetBackgroundYPositionByStatus(speciesName, data.actionId);
                animalDom.style.background = 'transparent url("'+Images.Data.rabbit.src+'") no-repeat -' + backgroundPosX + 'px -' + backgroundPosY + 'px / '+backgroundImageWidth+'px '+backgroundImageHeight+'px';
                Animal.StartAnimation(speciesName, data.id, data.actionId);
            }
        }
        // Wolf
        else if(speciesName == 'wolf') {
            currentActionStatus = Variables.Settings.wolfActionStatus[data.actionId];

            Animal.Data.wolf[keyId].width = animalDomInfo.size;
            Animal.Data.wolf[keyId].height = animalDomInfo.size;
            Animal.Data.wolf[keyId].left = animalDomInfo.left;
            Animal.Data.wolf[keyId].top = animalDomInfo.top;

            if(data.movedTileIds.length > 0) { ifShowMoving = true; }

            const backgroundImageWidth = Sprites.Wolf.width / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            const backgroundImageHeight = Sprites.Wolf.height / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            
            if(currentActionStatus == 'dead' && ifShowMoving == false) {
                AnimationProcess.RemoveTargetDomId(keyId);
                ShadowControll.RemoveShadow(keyId);
                const boneSize = animalDomInfo.size / 2;
                animalDom.style.background = '';
                animalDom.style.textAlign = 'center';

                const newImg = document.createElement("img");
                newImg.style.position = "absolute";
                newImg.src = Images.Data.animal_bones.src;
                newImg.width = boneSize;
                newImg.height = boneSize;
                // newImg.style.left = "50%";
                // newImg.style.top = "50%";
                // newImg.style.transform = "translate(-50%, -50%)";
                DomControll.ApplyTransform(newImg, 'translate', '-50%, -50%');
                DomControll.ApplyTransform(newImg, 'translate3d', '50%, 50%, 0px');
                const oldImg = animalDom.querySelector("img");
                if (oldImg) { animalDom.replaceChild(newImg, oldImg); }
                else { animalDom.appendChild(newImg); }

                if(animalWrapDom.firstChild != null) { animalWrapDom.insertBefore(animalDom, animalWrapDom.firstChild); }
                MovementProcess.RemoveTargetDomId(keyId);
            }
            else {
                let backgroundPosX = 0;
                if(data.actionId > 5) {
                    backgroundPosX = (data.actionId - 6) * Sprites.Wolf.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
                }
                const backgroundPosY = 0;
                animalDom.style.overflow = 'hidden';
                animalDom.style.background = 'transparent url("'+Images.Data.wolf_etc.src+'") no-repeat -' + backgroundPosX + 'px -' + backgroundPosY + 'px / '+backgroundImageWidth+'px '+backgroundImageHeight+'px';
                ShadowControll.CreateShadow(keyId);
            }

            

            if(ifShowMoving) {
                const backgroundPosX = 0;
                const backgroundPosY = Animal.GetBackgroundYPositionByStatus(speciesName, 1);
                animalDom.style.background = 'transparent url("'+Images.Data.wolf.src+'") no-repeat -' + backgroundPosX + 'px -' + backgroundPosY + 'px / '+backgroundImageWidth+'px '+backgroundImageHeight+'px';

                Animal.Data.wolf[keyId].currentActionFrameCount = Sprites.Wolf.frameCounts[1];
                const frameDelay = Animal.CalculateWalkingAnimationFrameDelay(speciesName, data.movedTileIds.length);
                Animal.Data.wolf[keyId].currentActionFrameDelay = frameDelay;
                Animal.StartAnimation(speciesName, data.id, 1);
            }
            else if(
                Variables.Settings.wolfActionStatus[data.actionId]=='mating' ||
                Variables.Settings.wolfActionStatus[data.actionId]=='pregnant' ||
                Variables.Settings.wolfActionStatus[data.actionId]=='breeding'
            ) {
                if(Variables.Settings.wolfActionStatus[data.actionId]=='pregnant') {
                    animalDom.style.filter = 'brightness(110%)';
                }
                else {
                    animalDom.style.filter = 'brightness(100%)';
                }
                Animal.DrawEtcBackground(keyId, data.actionId);
            }
            else if(Variables.Settings.wolfActionStatus[data.actionId]!='dead') {
                Animal.Data.wolf[keyId].currentActionFrameCount = Sprites.Wolf.frameCounts[data.actionId];
                Animal.Data.wolf[keyId].currentActionFrameDelay = Sprites.Wolf.frameDelay[data.actionId];
                const backgroundPosX = 0;
                const backgroundPosY = Animal.GetBackgroundYPositionByStatus(speciesName, data.actionId);
                animalDom.style.background = 'transparent url("'+Images.Data.wolf.src+'") no-repeat -' + backgroundPosX + 'px -' + backgroundPosY + 'px / '+backgroundImageWidth+'px '+backgroundImageHeight+'px';
                Animal.StartAnimation(speciesName, data.id, data.actionId);
            }
        }

        let finalData;
        if(speciesName == 'rabbit') { finalData = Animal.Data.rabbit[keyId]; }
        else if(speciesName == 'wolf') { finalData = Animal.Data.wolf[keyId]; }

        Animal.ApplyAnimalDomTransform(animalDom, finalData);
        if(currentActionStatus != 'dead') {
            ShadowControll.UpdateShadowSize(keyId);
            ShadowControll.UpdateShadowPosition(keyId);
        }

        if(ifShowMoving) {
            Animal.StartAnimalMoving(speciesName, data);
        }
    },
    CalculateWalkingAnimationFrameDelay: (speciesName, movedTilesCount) => {
        let defaultDelay;
        if (speciesName === 'rabbit') {
            defaultDelay = Sprites.Rabbit.frameDelay[1];
            const halfDelay = defaultDelay / 2;
            const divideFactor = Math.max(movedTilesCount, 1) / 16;
            let newDelay = defaultDelay / divideFactor;
            if (newDelay > defaultDelay) { newDelay = defaultDelay; }
            else if (newDelay < halfDelay ) { newDelay = halfDelay; }
            return newDelay;
        }
        else if (speciesName === 'wolf') {
            defaultDelay = Sprites.Wolf.frameDelay[1];
            const halfDelay = defaultDelay / 2;
            const divideFactor = Math.max(movedTilesCount, 1) / 16;
            let newDelay = defaultDelay / divideFactor;
            if (newDelay > defaultDelay) { newDelay = defaultDelay; }
            else if (newDelay < halfDelay ) { newDelay = halfDelay; }
            return newDelay;
        }
        return defaultDelay;
    },
    ApplyAnimalDomTransform: (animalDom, data) => {
        const maxGrowth = Variables.Settings.animalMaxGrowthForScale;
        let animalGrowth = data.growth;
        if(animalGrowth < 5) { animalGrowth = 5; }
        else if(animalGrowth > maxGrowth) { animalGrowth = maxGrowth; }
        const scale = (1/maxGrowth * animalGrowth);
        DomControll.ApplyTransform(animalDom, 'scale', scale);

        const movingDirection = animalDom.getAttribute('movingDirection');
        if(movingDirection == 'left') {
            DomControll.RemoveTransform(animalDom, 'scaleX');
        }
        else if(movingDirection == 'right') {
            DomControll.ApplyTransform(animalDom, 'scaleX', -1);
        }
    },
    DrawEtcBackground: (keyId, actionId) => {
        if(keyId.indexOf('rabbit') !== -1) {
            const animalDom = document.getElementById(keyId);
            const backgroundImageWidth = Sprites.Rabbit.etcImageWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            const backgroundImageHeight = Sprites.Rabbit.etcImageHeight / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            const backgroundPosX = (actionId - 6) * Sprites.Rabbit.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            const backgroundPosY = 0;
            animalDom.style.overflow = 'hidden';
            animalDom.style.background = 'transparent url("'+Images.Data.rabbit_etc.src+'") no-repeat -' + backgroundPosX + 'px -' + backgroundPosY + 'px / '+backgroundImageWidth+'px '+backgroundImageHeight+'px';
        }
        else if(keyId.indexOf('wolf') !== -1) {
            const animalDom = document.getElementById(keyId);
            const backgroundImageWidth = Sprites.Wolf.etcImageWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            const backgroundImageHeight = Sprites.Wolf.etcImageHeight / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            const backgroundPosX = (actionId - 6) * Sprites.Wolf.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            const backgroundPosY = 0;
            animalDom.style.overflow = 'hidden';
            animalDom.style.background = 'transparent url("'+Images.Data.wolf_etc.src+'") no-repeat -' + backgroundPosX + 'px -' + backgroundPosY + 'px / '+backgroundImageWidth+'px '+backgroundImageHeight+'px';
        }
    },
    DrawAnimalBones: (speciesName, data) => {
        if(data == undefined) { return; }
        
        const animalWrapDomId = 'animalWrapDom';
        const animalWrapDom = Variables.Doms.get(animalWrapDomId);
        if(!animalWrapDom) { return; }
        
        const keyId = speciesName + '-' + data.id;

        const animalDomInfo = Methods.GetAnimalDomInfo(data.position, keyId);
        if(animalDomInfo == null) {
            console.error('animalDomInfo == null, speciesName: ' + speciesName + ', id: ' + data.id);
            return;
        }
        AnimationProcess.RemoveTargetDomId(keyId);

        const boneSize = animalDomInfo.size / 2;
        let animalDom = document.getElementById(keyId);
        animalDom.style.background = '';
        animalDom.style.textAlign = 'center';

        const newImg = document.createElement("img");
        newImg.style.position = "absolute";
        newImg.src = window.cdnPrefix + '/img/animal_bones_tiny.png';
        newImg.width = boneSize;
        newImg.height = boneSize;
        // newImg.style.left = "50%";
        // newImg.style.top = "50%";
        // newImg.style.transform = "translate(-50%, -50%)";
        DomControll.ApplyTransform(newImg, 'translate', '-50%, -50%');
        DomControll.ApplyTransform(newImg, 'translate3d', '50%, 50%, 0px');
        const oldImg = animalDom.querySelector("img");
        if (oldImg) { animalDom.replaceChild(newImg, oldImg); }
        else { animalDom.appendChild(newImg); }
        
        if(animalWrapDom.firstChild != null) { animalWrapDom.insertBefore(animalDom, animalWrapDom.firstChild); }
        MovementProcess.RemoveTargetDomId(keyId);
    },
    DefineActionId: (speciesName, data) => {
        if(speciesName == 'rabbit') {
            if( data.movedTileIds.length > 0 ) {
                if(data.actionId == 2 || data.actionId == 5) {
                    return 2;
                }
                else {
                    return 1;
                }
            }
            return data.actionId;
        }
    },
    UpsertData: (speciesName, data) => {
        if(speciesName == 'rabbit') {
            const currentActionFrame = 0;
            const keyId = speciesName + '-' + data.id;
            if(Animal.Data.rabbit[keyId] != undefined && Animal.Data.rabbit[keyId].actionId == 2 && data.ateWeedTileId != undefined) {
                Animal.RemoveWeedAfterEating(data.ateWeedTileId);
            }
            let actionIdForAnimation = data.actionId;
            if(data.movedTileIds.length > 0 && ( data.actionId == 2 || data.actionId == 9)) {
                actionIdForAnimation = 1;
            }
            Animal.Data.rabbit[keyId] = {
                id: data.id,
                growth: data.growth,
                actionId: data.actionId,
                position: data.currentPosition,
                reservedTiles: data.reservedTiles,
                movedTileIds: data.movedTileIds,
                ateWeedTileId: data.ateWeedTileId == undefined ? "" : data.ateWeedTileId,
                currentActionFrame: currentActionFrame,
                actionIdForAnimation: actionIdForAnimation,
                currentActionFrameCount: Sprites.Rabbit.frameCounts[actionIdForAnimation],
                currentActionFrameDelay: Sprites.Rabbit.frameDelay[actionIdForAnimation],
                currentMoveFrameDelay: Sprites.Rabbit.frameDelay[actionIdForAnimation],

            };
        }
        else if(speciesName == 'wolf') {
            const currentActionFrame = 0;
            const keyId = speciesName + '-' + data.id;
            let actionIdForAnimation = data.actionId;
            if(data.movedTileIds.length > 0 && ( data.actionId == 2 || data.actionId == 9)) {
                actionIdForAnimation = 1;
            }
            Animal.Data.wolf[keyId] = {
                id: data.id,
                growth: data.growth,
                actionId: data.actionId,
                position: data.currentPosition,
                reservedTiles: data.reservedTiles,
                movedTileIds: data.movedTileIds,
                currentActionFrame: currentActionFrame,
                actionIdForAnimation: actionIdForAnimation,
                currentActionFrameCount: Sprites.Wolf.frameCounts[actionIdForAnimation],
                currentActionFrameDelay: Sprites.Wolf.frameDelay[actionIdForAnimation],
            };
        }
    },
    RemoveWeedAfterEating: (tileId, districtId) => {
        let rabbitFecesExists = false;
        let wolfFecesExists = false;
        if(districtId != undefined && Data.Weed.DistrictData[districtId] != undefined) {
            if(Data.Feces.DistrictData[districtId] != undefined && Data.Feces.DistrictData[districtId][tileId] != undefined) {
                rabbitFecesExists = Data.Feces.DistrictData[districtId][tileId][0];
                wolfFecesExists = Data.Feces.DistrictData[districtId][tileId][1];
            }
            Data.Feces.DistrictData[districtId] = [];
            Data.Feces.DistrictData[districtId][tileId] = [rabbitFecesExists, wolfFecesExists];
        }
        const mapWarpLeftTop = Methods.GetLeftTopMapWrap();
        const tileIdSplit = tileId.split(':');
        const xPos = parseInt(tileIdSplit[0], 10) * Variables.MapScaleInfo.current + mapWarpLeftTop[0];
        const yPos = parseInt(tileIdSplit[1], 10) * Variables.MapScaleInfo.current + mapWarpLeftTop[1];
        const viewSize = Variables.MapScaleInfo.current;
        if(document.getElementById('weedCanvas') ==null) { return; }
        const ctx = document.getElementById('weedCanvas').getContext('2d');
        Core.DrawDirtFloorOnTile(ctx, xPos, yPos, viewSize, [rabbitFecesExists, wolfFecesExists]);
    },
    StartAnimation: (speciesName, id, actionId) => {
        const keyId = speciesName + '-' + id;
        const animalDom = document.getElementById(keyId);
        let animalData;
        if(speciesName == 'rabbit') { animalData = Animal.Data.rabbit[keyId]; }
        else if(speciesName == 'wolf') { animalData = Animal.Data.wolf[keyId]; }

        if(animalDom == null) {
            console.log('animalDom == null, speciesName: ' + speciesName + ', id: ' + id);
            return;
        }
        if(Animal.IfActionStatusIsValid(speciesName, actionId)) {
            if(animalData == undefined ) {
                console.log('Animal.Data[keyId] == undefined, speciesName: ' + speciesName + ', id: ' + id);
                return;
            }
            AnimationProcess.AddTargetDomId(keyId);
            AnimationProcess.StartAnimation();
        }
    },
    ContinueAnimation: (speciesName, id, actionId) => {
        const keyId = speciesName + '-' + id;
        const animalDom = document.getElementById(keyId);
        if(animalDom == null) { return; }

        let animalData;
        if(speciesName == 'rabbit') { animalData = Animal.Data.rabbit[keyId]; }
        else if(speciesName == 'wolf') { animalData = Animal.Data.wolf[keyId]; }
        if(animalData == undefined ) {
            console.log('Animal.Data[keyId] == undefined, speciesName: ' + speciesName + ', id: ' + id);
            return;
        }
        if(!Animal.IfActionStatusIsValid(speciesName, actionId)) {
            AnimationProcess.RemoveTargetDomId(keyId);
            return;
        }

        animalData.currentActionFrame++;
        if(animalData.currentActionFrame >= animalData.currentActionFrameCount) { animalData.currentActionFrame = 0; }
        const previousPosX = animalDom.style.backgroundPosition.split(' ');
        const posY = parseInt(previousPosX[1], 10);
        if(speciesName == 'rabbit') {
            const oneFrameSize = Sprites.Rabbit.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            animalDom.style.backgroundPosition = '-' + animalData.currentActionFrame * oneFrameSize + 'px ' + posY + 'px';
            Animal.Data.rabbit[keyId] = animalData;
        }
        else if(speciesName == 'wolf') {
            const oneFrameSize = Sprites.Wolf.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            animalDom.style.backgroundPosition = '-' + animalData.currentActionFrame * oneFrameSize + 'px ' + posY + 'px';
            Animal.Data.wolf[keyId] = animalData;
        }
    },
    DefineMovingDirection: (tile1, tile2) => {
        const [x1, y1] = tile1.split(':').map(Number);
        const [x2, y2] = tile2.split(':').map(Number);
        if (x1 === x2) { return y2 < y1 ? 'right' : 'left'; }
        return x2 > x1 ? 'right' : 'left';
    },
    StartAnimalMoving: (speciesName, data) => {
        if(speciesName == 'rabbit') {
            const keyId = speciesName + '-' + data.id;
            if(data.movedTileIds.length > 0) {
                DomControll.AddTargetDomId(keyId);
                DomControll.StartProcess();
                const startTile = data.movedTileIds[0];
                const endTile = data.movedTileIds[data.movedTileIds.length-1];
                const rabbitDom = document.getElementById(keyId);
                if(rabbitDom != null) {
                    const movingDirection = Animal.DefineMovingDirection(startTile, endTile);
                    rabbitDom.setAttribute('movingDirection', movingDirection);
                }
                MovementProcess.TriggerMovement(keyId, data.movedTileIds, 30);
            }
            else {
                console.log('rabbitDom == null, speciesName: ' + speciesName + ', id: ' + data.id);
            }
        }
        else if(speciesName == 'wolf') {
            const keyId = speciesName + '-' + data.id;
            if(data.movedTileIds.length > 0) {
                DomControll.AddTargetDomId(keyId);
                DomControll.StartProcess();
                const startTile = data.movedTileIds[0];
                const endTile = data.movedTileIds[data.movedTileIds.length-1];
                const wolfDom = document.getElementById(keyId);
                if(wolfDom != null) {
                    const movingDirection = Animal.DefineMovingDirection(startTile, endTile);
                    wolfDom.setAttribute('movingDirection', movingDirection);
                }
                MovementProcess.TriggerMovement(keyId, data.movedTileIds, 100);
            }
            else {
                console.log('wolfDom == null, speciesName: ' + speciesName + ', id: ' + data.id);
            }
        }
    },
    UpdateAnimalDomAfterMoving: (speciesName, keyId, movementData) => {
        if(speciesName == 'rabbit') {
            DomControll.RemoveTargetDomId(keyId);
            const animalDom = document.getElementById(keyId);
            if(animalDom == null) { return; }
            // DomControll.RemoveTransform(animalDom, 'translate3d');
            animalDom.style.backgroundPositionX = '0px';

            let originalActionId = Animal.Data.rabbit[keyId].actionId;
            if(Variables.Settings.rabbitActionStatus[originalActionId]=='dead') {
                AnimationProcess.RemoveTargetDomId(keyId);
                ShadowControll.RemoveShadow(keyId);
                Animal.DrawAnimalBones(speciesName, Animal.Data.rabbit[keyId]);
            }
            else if(
                Variables.Settings.rabbitActionStatus[originalActionId]=='mating' ||
                Variables.Settings.rabbitActionStatus[originalActionId]=='pregnant' ||
                Variables.Settings.rabbitActionStatus[originalActionId]=='breeding'
            ) {
                AnimationProcess.RemoveTargetDomId(keyId);
                Animal.DrawEtcBackground(keyId, originalActionId);
            }
            else {
                if(Variables.Settings.rabbitActionStatus[originalActionId]!='eating' && Variables.Settings.rabbitActionStatus[originalActionId]!='sleep') {
                    originalActionId = 0;
                }
                Animal.Data.rabbit[keyId].currentActionFrameCount = Sprites.Rabbit.frameCounts[originalActionId];
                Animal.Data.rabbit[keyId].currentActionFrameDelay = Sprites.Rabbit.frameDelay[originalActionId];
                const backgroundPosY = Animal.GetBackgroundYPositionByStatus(speciesName, originalActionId);
                animalDom.style.backgroundPositionY = '-' + backgroundPosY + 'px';
            }

            const targetPosition = `${movementData.x}:${movementData.y}`;
            const mapPosition = Methods.GetAnimalDomInfo(targetPosition, keyId);
            if(mapPosition == null) {
                console.log('mapPosition == null, keyId: ' + keyId + ', targetPosition: ' + targetPosition);
                return;
            }
            // animalDom.style.left = mapPosition.left + 'px';
            // animalDom.style.top = mapPosition.top + 'px';
            DomControll.ApplyTransform(animalDom, 'translate3d', `${mapPosition.left}px, ${mapPosition.top}px, 0px`);
            
        }
        else if(speciesName == 'wolf') {
            DomControll.RemoveTargetDomId(keyId);
            const animalDom = document.getElementById(keyId);
            if(animalDom == null) { return; }
            // DomControll.RemoveTransform(animalDom, 'translate3d');
            animalDom.style.backgroundPositionX = '0px';

            let originalActionId = Animal.Data.wolf[keyId].actionId;
            if(Variables.Settings.wolfActionStatus[originalActionId]=='dead') {
                AnimationProcess.RemoveTargetDomId(keyId);
                ShadowControll.RemoveShadow(keyId);
                Animal.DrawAnimalBones(speciesName, Animal.Data.wolf[keyId]);
            }
            else if(
                Variables.Settings.wolfActionStatus[originalActionId]=='mating' ||
                Variables.Settings.wolfActionStatus[originalActionId]=='pregnant' ||
                Variables.Settings.wolfActionStatus[originalActionId]=='breeding'
            ) {
                AnimationProcess.RemoveTargetDomId(keyId);
                Animal.DrawEtcBackground(keyId, originalActionId);
            }
            else {
                if(Variables.Settings.wolfActionStatus[originalActionId]!='eating' && Variables.Settings.wolfActionStatus[originalActionId]!='sleep') {
                    originalActionId = 0;
                }
                Animal.Data.wolf[keyId].currentActionFrameCount = Sprites.Wolf.frameCounts[originalActionId];
                Animal.Data.wolf[keyId].currentActionFrameDelay = Sprites.Wolf.frameDelay[originalActionId];
                const backgroundPosY = Animal.GetBackgroundYPositionByStatus(speciesName, originalActionId);
                animalDom.style.backgroundPositionY = '-' + backgroundPosY + 'px';
            }

            const targetPosition = `${movementData.x}:${movementData.y}`;
            const mapPosition = Methods.GetAnimalDomInfo(targetPosition, keyId);
            if(mapPosition == null) {
                console.log('mapPosition == null, keyId: ' + keyId + ', targetPosition: ' + targetPosition);
                return;
            }
            // animalDom.style.left = mapPosition.left + 'px';
            // animalDom.style.top = mapPosition.top + 'px';
            DomControll.ApplyTransform(animalDom, 'translate3d', `${mapPosition.left}px, ${mapPosition.top}px, 0px`);
            
        }
    },
    IfActionStatusIsValid: (speciesName, actionId) => {
        let isValid = true;
        if(speciesName == 'rabbit') {
            if(Sprites.Rabbit.actions[actionId] == undefined) {
                isValid = false;
            }
        }
        else if(speciesName == 'wolf') {
            if(Sprites.Wolf.actions[actionId] == undefined) {
                isValid = false;
            }
        }
        return isValid;
    },
    GetBackgroundYPositionByStatus: (speciesName, actionId) => {
        let yPos = 0;
        if(speciesName == 'rabbit') {
            if(actionId <= 5) {
                yPos = Sprites.Rabbit.frameHeight / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current * actionId;
            }
        }
        else if(speciesName == 'wolf') {
            if(actionId <= 5) {
                yPos = Sprites.Wolf.frameHeight / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current * actionId;
            }
        }
        return yPos;
    },
};