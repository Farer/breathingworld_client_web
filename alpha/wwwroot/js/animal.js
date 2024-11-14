'use strict';
const Animal = {
    Data: {
        rabbit: [],
    },
    Timeout: [],
    DecodeRabbitBytes: (rabbitsBytes) => {
        const base64Data = rabbitsBytes;
        const decodedData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const rabbitInfoArray = msgpack.decode(decodedData);
        return Methods.MapRabbitArrayToObject(rabbitInfoArray);
    },
    RemoveDom: (speciesName, animalId) => {
        const keyId = speciesName + '-' + animalId;
        const animalDom = document.getElementById(keyId);
        if(animalDom != null) {
            animalDom.parentNode.removeChild(animalDom);
        }
    },
    DrawDom: (speciesName, data) => {
        if(data.actionId == undefined) { data.actionId = 0; }
        const keyId = speciesName + '-' + data.id;
        let animalDom = document.getElementById(keyId);
        const animalWrapDom = document.getElementById('animalWrapDom');
        if(animalWrapDom == null) { return; }
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

        animalDom.style.left = animalDomInfo.left + 'px';
        animalDom.style.top = animalDomInfo.top + 'px';

        Animal.Data.rabbit[keyId].width = animalDomInfo.size;
        Animal.Data.rabbit[keyId].height = animalDomInfo.size;
        Animal.Data.rabbit[keyId].left = animalDomInfo.left;
        Animal.Data.rabbit[keyId].top = animalDomInfo.top;

        let ifShowMoving = false;
        if(data.movedTileIds.length > 0) { ifShowMoving = true; }

        const backgroundImageWidth = Sprites.Rabbit.width / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
        const backgroundImageHeight = Sprites.Rabbit.height / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
        
        if(Variables.Settings.rabbitActionStatus[data.actionId]=='dead' && ifShowMoving == false) {
            AnimationProcess.RemoveTargetDomId(keyId);
            const boneSize = animalDomInfo.size / 2;
            animalDom.style.background = '';
            animalDom.style.textAlign = 'center';
            animalDom.innerHTML = '<img style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);" src="'+Images.Data.animal_bones.src+'" width="'+boneSize+'px" height="'+boneSize+'px" />';
            if(animalWrapDom.firstChild != null) { animalWrapDom.insertBefore(animalDom, animalWrapDom.firstChild); }
            clearTimeout(Animal.Timeout[keyId]);
            clearTimeout(Data.AnimalMoving.timeouts[keyId]);
        }
        else {
            let backgroundPosX = 0;
            if(data.actionId > 5) {
                backgroundPosX = (data.actionId - 6) * Sprites.Rabbit.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            }
            const backgroundPosY = 0;
            animalDom.style.overflow = 'hidden';
            animalDom.style.background = 'transparent url("'+Images.Data.rabbit_etc.src+'") no-repeat -' + backgroundPosX + 'px -' + backgroundPosY + 'px / '+backgroundImageWidth+'px '+backgroundImageHeight+'px';
        }
            
        if(ifShowMoving) {
            const backgroundPosX = 0;
            const backgroundPosY = Animal.GetBackgroundYPositionByStatus(speciesName, 1);
            animalDom.style.background = 'transparent url("'+Images.Data.rabbit.src+'") no-repeat -' + backgroundPosX + 'px -' + backgroundPosY + 'px / '+backgroundImageWidth+'px '+backgroundImageHeight+'px';

            Animal.Data.rabbit[keyId].currentActionFrameCount = Sprites.Rabbit.frameCounts[1];
            const frameDelay = Animal.CalculateWalkingAnimationFrameDelay(speciesName, data.movedTileIds.length);
            Animal.Data.rabbit[keyId].currentActionFrameDelay = frameDelay;
            Animal.StartAnimation(speciesName, data.id, 1);
            data.nextActionDateTime = new Date((data.updateTimeUnix + Variables.Settings.averageRabbitProceedIntervalSeconds)*1000);
            let timeDiff = data.nextActionDateTime.getTime() - new Date().getTime();
            if(timeDiff < 0) { timeDiff = 0; }
            Animal.StartAnimalMoving(speciesName, data, timeDiff);
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
        animalDom.style.transform = Animal.MakeAnimalDomTrasformString(speciesName, Animal.Data.rabbit[keyId]);
    },
    CalculateWalkingAnimationFrameDelay: (speciesName, movedTilesCount) => {
        const defaultDelay = Sprites.Rabbit.frameDelay[1];
        const halfDelay = defaultDelay / 2;
        if (speciesName === 'rabbit') {
            const divideFactor = Math.max(movedTilesCount, 1) / 16;
            let newDelay = defaultDelay / divideFactor;
            if (newDelay > defaultDelay) { newDelay = defaultDelay; }
            else if (newDelay < halfDelay ) { newDelay = halfDelay; }
            return newDelay;
        }
        return defaultDelay;
    },
    MakeAnimalDomTrasformString: (speciesName, data) => {
        let transformString = '';
        const maxGrowth = Variables.Settings.animalMaxGrowthForScale;
        let animalGrowth = data.growth;
        if(animalGrowth < 5) { animalGrowth = 5; }
        else if(animalGrowth > maxGrowth) { animalGrowth = maxGrowth; }
        const scale = (1/maxGrowth * animalGrowth);
        transformString += ' scale('+scale+')';

        const keyId = speciesName + '-' + data.id;
        const animalDom = document.getElementById(keyId);
        const movingDirection = animalDom.getAttribute('movingDirection');
        if(movingDirection == 'left') { transformString += ''; }
        else if(movingDirection == 'right') { transformString += ' scaleX(-1)'; }

        return transformString;
    },
    DrawEtcBackground: (keyId, actionId) => {
        const animalDom = document.getElementById(keyId);
        const backgroundImageWidth = Sprites.Rabbit.etcImageWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
        const backgroundImageHeight = Sprites.Rabbit.etcImageHeight / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
        const backgroundPosX = (actionId - 6) * Sprites.Rabbit.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
        const backgroundPosY = 0;
        animalDom.style.overflow = 'hidden';
        animalDom.style.background = 'transparent url("'+Images.Data.rabbit_etc.src+'") no-repeat -' + backgroundPosX + 'px -' + backgroundPosY + 'px / '+backgroundImageWidth+'px '+backgroundImageHeight+'px';
    },
    DrawAnimalBones: (speciesName, data) => {
        if(data == undefined) { return; }
        const animalWrapDom = document.getElementById('animalWrapDom');
        if(animalWrapDom == null) { return; }
        
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
        animalDom.innerHTML = '<img style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);" src="' + window.cdnPrefix + '/img/animal_bones_tiny.png" width="'+boneSize+'px" height="'+boneSize+'px" />';
        if(animalWrapDom.firstChild != null) { animalWrapDom.insertBefore(animalDom, animalWrapDom.firstChild); }
        clearTimeout(Animal.Timeout[keyId]);
        clearTimeout(Data.AnimalMoving.timeouts[keyId]);
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
        }
        const mapWarpLeftTop = Methods.GetLeftTopMapWrap();
        const tileIdSplit = tileId.split(':');
        const xPos = parseInt(tileIdSplit[0], 10) * Variables.MapScaleInfo.current + mapWarpLeftTop[0];
        const yPos = parseInt(tileIdSplit[1], 10) * Variables.MapScaleInfo.current + mapWarpLeftTop[1];
        const viewSize = Variables.MapScaleInfo.current;
        if(document.getElementById('weedCanvas') ==null) { return; }
        const ctx = document.getElementById('weedCanvas').getContext('2d');
        Core.DrawDirtFloorOnTile(ctx, xPos, yPos, viewSize);
        if(rabbitFecesExists) { Core.DrawFecesOnTile(ctx, xPos, yPos, viewSize);} 
    },
    StartAnimation: (speciesName, id, actionId) => {
        const keyId = speciesName + '-' + id;
        const animalDom = document.getElementById(keyId);
        if(animalDom == null) {
            console.log('animalDom == null, speciesName: ' + speciesName + ', id: ' + id);
            return;
        }
        if(Animal.IfActionStatusIsValid(speciesName, actionId)) {
            if(Animal.Data.rabbit[keyId] == undefined ) {
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
        if(Animal.Data.rabbit[keyId] == undefined ) { return; }

        let data = Animal.Data.rabbit[keyId];
        data.currentActionFrame++;
        if(data.currentActionFrame >= data.currentActionFrameCount) { data.currentActionFrame = 0; }
        const previousPosX = animalDom.style.backgroundPosition.split(' ');
        const posY = parseInt(previousPosX[1], 10);
        const oneFrameSize = Sprites.Rabbit.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
        animalDom.style.backgroundPosition = '-' + data.currentActionFrame * oneFrameSize + 'px ' + posY + 'px';
        Animal.Data.rabbit[keyId] = data;

    },
    DefineMovingDirection: (tile1, tile2) => {
        const [x1, y1] = tile1.split(':').map(Number);
        const [x2, y2] = tile2.split(':').map(Number);
        if (x1 === x2) { return y2 < y1 ? 'right' : 'left'; }
        return x2 > x1 ? 'right' : 'left';
    },
    StartAnimalMoving: (speciesName, data, timeDiff) => {
        if(speciesName == 'rabbit') {
            const keyId = speciesName + '-' + data.id;
            
            clearTimeout(Data.AnimalMoving.timeouts[keyId]);
            Data.AnimalMoving.movingTileIds[keyId] = [];
            if(data.movedTileIds.length > 0) {
                DomControll.AddTargetDomId(keyId);
                DomControll.StartAnimation();
                const startTile = data.movedTileIds[0];
                const endTile = data.movedTileIds[data.movedTileIds.length-1];
                const rabbitDom = document.getElementById(keyId);
                if(rabbitDom != null) {
                    const movingDirection = Animal.DefineMovingDirection(startTile, endTile);
                    rabbitDom.setAttribute('movingDirection', movingDirection);
                }
                const movingSpeed = Variables.Settings.averageRabbitProceedIntervalSeconds*1000 / data.movedTileIds.length / 3;
                const targetTileIdsCount = data.movedTileIds.length;
                let willMoveTileIds = [];
                for(let i=0; i<targetTileIdsCount; i++) {
                    const tileId = data.movedTileIds.pop();
                    if(tileId == undefined) { continue; }
                    willMoveTileIds.unshift(tileId);
                }
                Data.AnimalMoving.timeoutIntervals[keyId] = movingSpeed;
                Data.AnimalMoving.movingTileIds[keyId] = willMoveTileIds;
                Data.AnimalMoving.reservedTiles[keyId] = data.reservedTiles;
                Animal.ContinueAnimalMoving(speciesName, keyId);
            }
        }
    },
    ContinueAnimalMoving: (speciesName, keyId) => {
        if(Data.AnimalMoving.movingTileIds[keyId] == undefined || Data.AnimalMoving.movingTileIds[keyId].length == 0) {
            DomControll.RemoveTargetDomId(keyId);
            const animalDom = document.getElementById(keyId);
            if(animalDom == null) { return; }
            animalDom.style.backgroundPositionX = '0px';

            let originalActionId = Animal.Data.rabbit[keyId].actionId;
            if(Variables.Settings.rabbitActionStatus[originalActionId]=='dead') {
                AnimationProcess.RemoveTargetDomId(keyId);
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
            return;
        }
        const targetPosition = Data.AnimalMoving.movingTileIds[keyId].shift();
        const mapPosition = Methods.GetAnimalDomInfo(targetPosition, keyId);
        if(mapPosition == null) {
            console.log('mapPosition == null, keyId: ' + keyId + ', targetPosition: ' + targetPosition);
            return;
        }
        const animalDom = document.getElementById(keyId);
        if(animalDom == null) {
            clearTimeout(Data.AnimalMoving.timeouts[keyId]);
            Data.AnimalMoving.timeoutIntervals[keyId] = null;
            Data.AnimalMoving.movingTileIds[keyId] = null;
            return;
        }

        animalDom.style.transform = Animal.MakeAnimalDomTrasformString(speciesName, Animal.Data.rabbit[keyId]);

        animalDom.style.left = mapPosition.left + 'px';
        animalDom.style.top = mapPosition.top + 'px';

        Data.AnimalMoving.timeouts[keyId] = setTimeout(() => {
            Animal.ContinueAnimalMoving(speciesName, keyId);
        }, Data.AnimalMoving.timeoutIntervals[keyId]);
    },
    IfActionStatusIsValid: (speciesName, actionId) => {
        let isValid = true;
        if(speciesName == 'rabbit') {
            if(Sprites.Rabbit.actions[actionId] == undefined) {
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
        return yPos;
    },
};