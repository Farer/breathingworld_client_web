'use strict';
const Methods = {
    GatherViewDistrictIds: () => {
        let districtIds = [];
        const leftTop = Methods.GetLeftTopMapWrap();
        const startX = leftTop[0] / Variables.MapScaleInfo.current;
        const startY = leftTop[1] / Variables.MapScaleInfo.current;
        const endX = startX - Variables.MapCanvasInfo.widthOfCanvas / Variables.MapScaleInfo.current;
        const endY = startY - Variables.MapCanvasInfo.heightOfCanvas / Variables.MapScaleInfo.current;

        const districtStartX = parseInt(Math.abs(startX / Variables.Settings.districtWidth), 10);
        const districtStartY = parseInt(Math.abs(startY / Variables.Settings.districtHeight), 10);
        const districtEndX = parseInt(Math.abs(endX / Variables.Settings.districtWidth), 10);
        const districtEndY = parseInt(Math.abs(endY / Variables.Settings.districtHeight), 10);

        for(let y=districtStartY; y<=districtEndY; y++) {
            for(let x=districtStartX; x<=districtEndX; x++) {
                districtIds.push(Methods.DefineDistrictIdByPosition(x, y));
            }
        }
        return districtIds;
    },
    DefineDistrictIdByPosition: (xPos, yPos) => {
        const divide = Variables.MapInfo.mapMinWidth / Variables.Settings.districtWidth;
        return yPos * divide + xPos;
    },
    DefineDistrictIdByTileId: (tileId) => {
        const split = tileId.split(":");
        const xPos = parseInt(split[0], 10);
        const yPos = parseInt(split[1], 10);
        const row = Variables.MapInfo.mapMinWidth / Variables.Settings.districtWidth;
        const xId = parseInt(xPos / Variables.Settings.districtWidth, 10);
        const yId = parseInt(yPos / Variables.Settings.districtHeight, 10);
        return yId * row + xId;
    },
    IfDistrictWeedCacheValid: (districtId) => {
        const nowDate = Date.now();
        const cacheExpireDiff = nowDate - Data.Weed.CacheExpireMillis;
        if(Data.Weed.DistrictDataUpdateTime[districtId] == undefined || Data.Weed.DistrictDataUpdateTime[districtId] <= cacheExpireDiff) {
            return false;
        }
        return true;
    },
    IfDistrictTreeCacheValid: (districtId) => {
        const nowDate = Date.now();
        const cacheExpireDiff = nowDate - Data.Tree.CacheExpireMillis;
        if(Data.Tree.DistrictDataUpdateTime[districtId] == undefined || Data.Tree.DistrictDataUpdateTime[districtId] <= cacheExpireDiff) {
            return false;
        }
        return true;
    },
    PrepareDistrictIdsToGet: () => {
        Data.Weed.DistrictIdsBucket.clear();
        for(let i=0; Variables.MapInfo.viewDistrictIds.length > i; i++) {
            Data.Weed.DistrictIdsBucket.add(Variables.MapInfo.viewDistrictIds[i]);
        }
    },
    GetDistrictDataOneByOneByFromBucket: () => {
        if(Data.Weed.DistrictIdsBucket.size == 0) { return; }
        const districtId = Data.Weed.DistrictIdsBucket.values().next().value;
        Data.Weed.DistrictIdsBucket.delete(districtId);
        Socket.GetWeedInfoByDistrictId(districtId);
        Socket.GetTreeInfoByDistrictId(districtId);
        Socket.GetRabbitInfoByDistrictId(districtId);
    },
    CleanPrepareWeedWrapDom: () => {
        if(Data.Weed.UserPaused == true && Variables.UserDragged == true) { return; }
        if(Data.Weed.UserPaused == false && Variables.UserDragged == false) { return; }
        let weedWrapDom = document.getElementById('weedWrapDom');
        if(weedWrapDom != null) { weedWrapDom.parentNode.removeChild(weedWrapDom); }
        weedWrapDom = document.createElement('div');
        weedWrapDom.id = 'weedWrapDom';
        weedWrapDom.style.position = 'absolute';
        weedWrapDom.style.left = '0px';
        weedWrapDom.style.top = '0px';

        const canvas = document.createElement('canvas');
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        canvas.id = 'weedCanvas';
        canvas.width = windowWidth;
        canvas.height = windowHeight;
        weedWrapDom.appendChild(canvas);

        document.getElementById('mapWrap').appendChild(weedWrapDom);
    },
    CleanPrepareAnimalWrapDom: () => {
        let animalWrapDom = document.getElementById('animalWrapDom');
        if(animalWrapDom != null) { animalWrapDom.parentNode.removeChild(animalWrapDom); }
        animalWrapDom = document.createElement('div');
        animalWrapDom.id = 'animalWrapDom';
        animalWrapDom.style.position = 'absolute';
        animalWrapDom.style.left = '0px';
        animalWrapDom.style.top = '0px';

        document.getElementById('mapWrap').appendChild(animalWrapDom);
    },
    CleanPrepareTreeWrapDom: () => {
        let treeWrapDom = document.getElementById('treeWrapDom');
        if(treeWrapDom != null) { treeWrapDom.parentNode.removeChild(treeWrapDom); }
        treeWrapDom = document.createElement('div');
        treeWrapDom.id = 'treeWrapDom';
        treeWrapDom.style.position = 'absolute';
        treeWrapDom.style.left = '0px';
        treeWrapDom.style.top = '0px';

        document.getElementById('mapWrap').appendChild(treeWrapDom);
    },
    RemoveWeedWrapDom: () => {
        const weedWrapDom = document.getElementById('weedWrapDom');
        if(weedWrapDom != null) {
            weedWrapDom.parentNode.removeChild(weedWrapDom);
        }
    },
    RemoveTreeWrapDom: () => {
        const treeWrapDom = document.getElementById('treeWrapDom');
        if(treeWrapDom != null) {
            treeWrapDom.parentNode.removeChild(treeWrapDom);
        }
    },
    RemoveAnimalWrapDom: () => {
        const animalWrapDom = document.getElementById('animalWrapDom');
        if(animalWrapDom != null) {
            animalWrapDom.parentNode.removeChild(animalWrapDom);
        }
    },
    GetLeftTopMapWrap: (givenDom) => {
        if(givenDom == undefined) { givenDom = document.getElementById('mapWrap'); }
        const leftTop = givenDom.getAttribute('leftTop').split('|');
        return [ parseInt(leftTop[0], 10), parseInt(leftTop[1], 10) ];
    },
    SetWhenUserStopAction: (fromId) => {
        Data.Weed.UserPaused = true;
        if(Variables.UserDragged == true) { Socket.UnjoinMapGroup(); }
        Variables.UserDragged = false;
    },
    GetAnimalDomInfo: (animalPosition, keyId) => {
        if(animalPosition == undefined) {
            console.log("GetAnimalDomInfo animalPosition: ", animalPosition);
            return null;
        }
        const positions = animalPosition.split(':');
        const animalScaledPosX = parseInt(positions[0], 10) * Variables.MapScaleInfo.current;
        const animalScaledPosY = parseInt(positions[1], 10) * Variables.MapScaleInfo.current;

        const currentMapLeftTop = Methods.GetLeftTopMapWrap();
        const mapScaledPosX = -currentMapLeftTop[0] * Variables.Settings.animalCoordinateScale;
        const mapScaledPosY = -currentMapLeftTop[1] * Variables.Settings.animalCoordinateScale;

        const canvasScaledWidth = Variables.MapCanvasInfo.widthOfCanvas * Variables.MapScaleInfo.current * Variables.Settings.animalCoordinateScale;
        const canvasScaledHeight = Variables.MapCanvasInfo.heightOfCanvas * Variables.MapScaleInfo.current * Variables.Settings.animalCoordinateScale;

        const diffPosX = animalScaledPosX - mapScaledPosX;
        const diffPosY = animalScaledPosY - mapScaledPosY;

        const xPercent = diffPosX * 100 / canvasScaledWidth;
        const yPercent = diffPosY * 100 / canvasScaledHeight;

        let left = Variables.MapCanvasInfo.widthOfCanvas * xPercent / 100 * Variables.MapScaleInfo.current;
        let top = Variables.MapCanvasInfo.heightOfCanvas * yPercent / 100 * Variables.MapScaleInfo.current;

        const size = Sprites.Rabbit.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
        left = left - ( size / 2 );
        
        const topModifier = Methods.CalculateAnimalDomTopModifier(keyId);
        top = top - topModifier;
        if(Animal.Data.rabbit[keyId].growth < Variables.Settings.animalMaxGrowthForScale) {
            const scale = Animal.Data.rabbit[keyId].growth / Variables.Settings.animalMaxGrowthForScale;
            const scaledSize = size * scale;
            const sizeDiff = size - scaledSize;
            top += sizeDiff/2 * 0.6;
        }

        return {
            size: size,
            left: left,
            top: top
        };
    },
    CalculateAnimalDomTopModifier: (keyId) => {
        const size = Sprites.Rabbit.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
        return size * 0.8;
    },
    DefineMapPositionByAnimalPosition: (animalPosition) => {
        const positions = animalPosition.split(":");
        const xPos = parseInt(positions[0], 10);
        const yPos = parseInt(positions[1], 10);
        const finalXpos = parseInt(xPos / Variables.Settings.animalCoordinateScale, 10).toString();
        const finalYpos = parseInt(yPos / Variables.Settings.animalCoordinateScale, 10).toString();
        return finalXpos + ':' + finalYpos;
    },
    MapRabbitArrayToObject: (rabbitArray) => {
        return {
            id: rabbitArray[0],
            gender: rabbitArray[1],
            movedTileIds: rabbitArray[2],
            reservedTiles: rabbitArray[3],
            currentPosition: rabbitArray[4],
            actionId: rabbitArray[5],
            lifeStatus: rabbitArray[6],
            energy: rabbitArray[7],
            hunger: rabbitArray[8],
            growth: rabbitArray[9],
            matingCount: rabbitArray[10],
            matingMaxCount: rabbitArray[11],
            pregnantCount: rabbitArray[12],
            pregnantMaxCount: rabbitArray[13],
            femaleTargetId: rabbitArray[14],
            matingTargetId: rabbitArray[15],
            moved: rabbitArray[16],
            nodeKind: rabbitArray[17],
            mapTileSightRange: rabbitArray[18],
            animalTileMovableRange: rabbitArray[19],
            concernedDistrictIds: rabbitArray[20],
            deadCount: rabbitArray[21],
            deadCountMax: rabbitArray[22],
            nextActionDateTime: rabbitArray[23],
            canInterfere: rabbitArray[24],
            doingInteraction: rabbitArray[25],
            updateTimeUnix: rabbitArray[26]
        };
    }
};