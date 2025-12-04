'use strict';
const Methods = {
    GetMonthAndDayByDayId: (dayId) => {
        if (dayId < 1 || dayId > Variables.TotalDaysInYear) {
            return { monthIndex: 1, day: 1 };
        }
        const daysInMonth = Variables.DaysInMonth;
        let remainingDays = dayId;
        for (let month = 1; month <= Variables.MonthNames.length; month++) {
            if (remainingDays <= daysInMonth[month - 1]) {
                return { monthIndex: month, day: remainingDays };
            }
            remainingDays -= daysInMonth[month - 1];
        }
        return { monthIndex: 1, day: 1 };
    },
    GetWeekIdByDayId: (dayId) => {
        const { monthIndex, day } = Methods.GetMonthAndDayByDayId(dayId);
        const daysPerWeek = Variables.DaysInMonth[monthIndex - 1] / Variables.WeeksPerMonth;
        const weekInMonth = Math.min(Variables.WeeksPerMonth, Math.ceil(day / daysPerWeek));
        return (monthIndex - 1) * Variables.WeeksPerMonth + weekInMonth;
    },
    CalculateMonthAndWeek: (weekId) => {
        if (weekId < 1 || weekId > Variables.TotalWeeksInYear) {
            return { 
                month: Variables.MonthNames[0], 
                week: 1,
            };
        }
        const monthIndex = Math.floor((weekId - 1) / Variables.WeeksPerMonth);
        const weekInMonth = ((weekId - 1) % Variables.WeeksPerMonth) + 1;
        return {
            month: Variables.MonthNames[monthIndex],
            week: weekInMonth,
        };
    },
    ParseWeatherInfo: (weatherInfo) => {
        const splitsWeatherInfo = weatherInfo.split('|');
        const info = splitsWeatherInfo[0]+"|"+splitsWeatherInfo[1]+"|"+splitsWeatherInfo[2]+"|"+splitsWeatherInfo[3];
        return {
            info: info,
            temperature: splitsWeatherInfo[4]
        }
    },
    ShowWeather:(canvasId, mode, options = {}) => {
        if (Variables.ActiveWeather && Variables.ActiveWeather.canvas.id !== canvasId) {
            Variables.ActiveWeather.stop();
            Variables.ActiveWeather = null;
        }
        if (!Variables.ActiveWeather) { Variables.ActiveWeather = new WeatherEffect(canvasId); }
        if (Variables.ActiveWeather.isValid) { Variables.ActiveWeather.show(mode, options); }
    },
    StopWeather:() => {
        if (Variables.ActiveWeather) {
            Variables.ActiveWeather.stop();
            Variables.ActiveWeather = null;
        }
    },
    ResizeWeather:() => {
        window.clearTimeout(Variables.WeatherResizeTimeout);
        Variables.WeatherResizeTimeout = window.setTimeout(() => {
            if(Variables.ActiveWeather) { Variables.ActiveWeather._resizeCanvas(); }
        }, 250);
    },
    DefineDistrictIdByPosition: (xPos, yPos) => {
        const divide = Variables.MapInfo.mapMinWidth / Variables.Settings.districtWidth;
        return yPos * divide + xPos;
    },
    IfDistrictEarthWormCacheValid: (districtId) => {
        const nowDate = Date.now();
        const cacheExpireDiff = nowDate - Data.EarthWorm.CacheExpireMillis;
        if(Data.EarthWorm.DistrictDataUpdateTime[districtId] == undefined || Data.EarthWorm.DistrictDataUpdateTime[districtId] <= cacheExpireDiff) { return false; }
        return true;
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
        Data.DistrictIdsBucket.clear();
        for(let i=0; Variables.MapInfo.viewDistrictIds.length > i; i++) {
            Data.DistrictIdsBucket.add(Variables.MapInfo.viewDistrictIds[i]);
        }
    },
    GetDistrictDataOneByOneByFromBucket: (fromId) => {
        // console.log(`GetDistrictDataOneByOneByFromBucket: ${fromId}`);
        if(Data.DistrictIdsBucket.size == 0) { return; }
        const districtId = Data.DistrictIdsBucket.values().next().value;
        Data.DistrictIdsBucket.delete(districtId);
        if(Variables.MapScaleInfo.current == 128) {
            Socket.GetEarthWormInfoByDistrictId(districtId);
        }
        Socket.GetWeedInfoByDistrictId(districtId);
        Socket.GetTreeInfoByDistrictId(districtId);
        Socket.GetRabbitInfoByDistrictId(districtId);
        Socket.GetWolfInfoByDistrictId(districtId);
        Methods.GetDistrictDataOneByOneByFromBucket(-1);
    },
    CleanPrepareWeedWrapDom: () => {
        return;
        if(Data.UserPaused == true && Variables.UserDragged == true) { return; }
        if(Data.UserPaused == false && Variables.UserDragged == false) { return; }
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

        const mapWrap = Variables.Doms.get('mapWrap');
        mapWrap.appendChild(weedWrapDom);
    },
    CleanPrepareEarthWormWrapDom: () => {
        if(Variables.MapScaleInfo.current != 128) { Methods.DeactivateEarthWormWrapDom(); return; }
        const wrapId = 'earthWormWrapDom';
        const canvasId = 'earthWormCanvas';
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        if(!Variables.Doms.has(wrapId)) {
            const earthWormWrapDom = document.createElement('div');
            earthWormWrapDom.id = wrapId;
            earthWormWrapDom.style.position = 'absolute';
            earthWormWrapDom.style.left = '0px';
            earthWormWrapDom.style.top = '0px';

            const canvas = document.createElement('canvas');
            canvas.id = canvasId;
            canvas.width = windowWidth;
            canvas.height = windowHeight;
            earthWormWrapDom.appendChild(canvas);
            Variables.EarthWormController = new EarthWormController(canvas);

            const mapWrap = Variables.Doms.get('mapWrap');
            mapWrap.appendChild(earthWormWrapDom);
            Variables.Doms.set(wrapId, earthWormWrapDom);
            Variables.Doms.set(canvasId, canvas);
        }
        const wrapDom = Variables.Doms.get(wrapId);
        wrapDom.style.left = '0px';
        wrapDom.style.top = '0px';
        wrapDom.style.display = '';
        const canvasDom = Variables.Doms.get(canvasId);
        canvasDom.width = windowWidth;
        canvasDom.height = windowHeight;
        canvasDom.getContext('2d').clearRect(0, 0, windowWidth, windowHeight);
    },
    CleanPrepareShadowWrapDom: () => {
        return;
        const domId = 'shadowWrapDom';
        let shadowWrapDom = Variables.Doms.get(domId);
        if(!shadowWrapDom) {
            shadowWrapDom = document.createElement('div');
            shadowWrapDom.id = 'shadowWrapDom';
            shadowWrapDom.style.position = 'absolute';
            const mapWrap = Variables.Doms.get('mapWrap');
            mapWrap.appendChild(shadowWrapDom);
            Variables.Doms.set(domId, shadowWrapDom);
        }
        shadowWrapDom.style.left = '0px';
        shadowWrapDom.style.top = '0px';
    },
    CleanPrepareAnimalWrapDom: () => {
        return;
        const animalWrapDomId = 'animalWrapDom';
        let animalWrapDom = Variables.Doms.get(animalWrapDomId);
        if(animalWrapDom) {
            animalWrapDom.style.left = '0px';
            animalWrapDom.style.top = '0px';
        }
        else {
            animalWrapDom = document.createElement('div');
            animalWrapDom.id = animalWrapDomId;
            animalWrapDom.style.position = 'absolute';
            animalWrapDom.style.left = '0px';
            animalWrapDom.style.top = '0px';
            const mapWrap = Variables.Doms.get('mapWrap');
            mapWrap.appendChild(animalWrapDom);
            Variables.Doms.set(animalWrapDomId, animalWrapDom);
        }
    },
    CleanPrepareTreeWrapDom: () => {
        return;
        const domId = 'treeWrapDom';
        let treeWrapDom = Variables.Doms.get(domId);
        if(!treeWrapDom) {
            treeWrapDom = document.createElement('div');
            treeWrapDom.id = 'treeWrapDom';
            treeWrapDom.style.position = 'absolute';
            const mapWrap = Variables.Doms.get('mapWrap');
            mapWrap.appendChild(treeWrapDom);
        }
        treeWrapDom.style.left = '0px';
        treeWrapDom.style.top = '0px';
        Variables.Doms.set(domId, treeWrapDom);
    },
    DeactivateEarthWormWrapDom: () => {
        const wrapId = 'earthWormWrapDom';
        if(Variables.Doms.has(wrapId)) {
            const wrapDom = Variables.Doms.get(wrapId);
            wrapDom.style.display = 'none';
        }
    },
    RemoveShadowWrapDom: () => {
        return;
        const targetDom = Variables.Doms.get('shadowWrapDom');
        if(targetDom) { targetDom.innerHTML = ''; }
    },
    RemoveWeedWrapDom: () => {
        return;
        const weedWrapDom = document.getElementById('weedWrapDom');
        if(weedWrapDom != null) {
            weedWrapDom.parentNode.removeChild(weedWrapDom);
        }
    },
    RemoveTreeWrapDom: () => {
        return;
        const targetDom = Variables.Doms.get('treeWrapDom');
        if(targetDom) { targetDom.innerHTML = ''; }
    },
    RemoveAnimalWrapDom: () => {
        return;
        const targetDom = Variables.Doms.get('animalWrapDom');
        if(targetDom) { targetDom.innerHTML = ''; }
    },
    GetLeftTopMapWrap: () => {
        return [Variables.MapViewPort.x, Variables.MapViewPort.y];
    },
    GetMapIndexByMapPosition: (x, y) => {
        return Variables.MapInfo.mapMinWidth * y + x;
    },
    GetAnimalPositionByIndex: (index) => {
        const realWidth = Variables.MapInfo.mapMinWidth * Variables.Settings.animalCoordinateScale;
        const xPos = index % realWidth;
        const yPos = Math.floor(index / realWidth);
        return xPos + ':' + yPos;
    },
    GetMapPositionByAnimalPositionIndex: (index) => {
        const realWidth = Variables.MapInfo.mapMinWidth * Variables.Settings.animalCoordinateScale;
        const xPos = index % realWidth;
        const yPos = Math.floor(index / realWidth);
        const finalXpos = parseInt(xPos / Variables.Settings.animalCoordinateScale, 10);
        const finalYpos = parseInt(yPos / Variables.Settings.animalCoordinateScale, 10);
        return {
            x: finalXpos,
            y: finalYpos
        }
    },
    GetAnimalRealPosition: (animalPositionString) => {
        if(animalPositionString == undefined) {
            console.log("GetAnimalRealPosition animalPositionString: ", animalPositionString);
            return null;
        }
        const positions = animalPositionString.split(':');
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
        
        return {
            left: left,
            top: top
        };
    },
    GetAnimalDomInfo: (animalPosition, keyId) => {
        const realPosition = Methods.GetAnimalRealPosition(animalPosition);
        let top = realPosition.top;
        let left = realPosition.left;

        const topModifier = Methods.CalculateAnimalDomTopModifier(keyId);
        top = top - topModifier;
        let size;
        if(keyId.indexOf('rabbit') !== -1) {
            size = Sprites.Rabbit.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            left = left - ( size / 2 );
            if(Animal.Data.rabbit[keyId].growth < Variables.Settings.animalMaxGrowthForScale) {
                const scale = Animal.Data.rabbit[keyId].growth / Variables.Settings.animalMaxGrowthForScale;
                const scaledSize = size * scale;
                const sizeDiff = size - scaledSize;
                top += sizeDiff/2 * 0.6;
            }
        }
        else if(keyId.indexOf('wolf') !== -1) {
            size = Sprites.Wolf.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
            left = left - ( size / 2 );
            if(Animal.Data.wolf[keyId].growth < Variables.Settings.animalMaxGrowthForScale) {
                const scale = Animal.Data.wolf[keyId].growth / Variables.Settings.animalMaxGrowthForScale;
                const scaledSize = size * scale;
                const sizeDiff = size - scaledSize;
                top += sizeDiff/2 * 0.6;
            }
        }

        return {
            size: size,
            left: left,
            top: top
        };
    },
    CalculateAnimalDomTopModifier: (keyId) => {
        let size;
        if(keyId.indexOf('rabbit') !== -1) {
            size = Sprites.Rabbit.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
        }
        else if(keyId.indexOf('wolf') !== -1) {
            size = Sprites.Wolf.frameWidth / Variables.MapScaleInfo.maxScale * Variables.MapScaleInfo.current;
        }
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
    ParseEarthWormInfo: (earthWormInfo) => {
        const splitsEarthWormInfo = earthWormInfo.split(':');
        const newPosition = splitsEarthWormInfo[4] ?? null;
        return {
            id: splitsEarthWormInfo[0],
            age: splitsEarthWormInfo[1],
            status: splitsEarthWormInfo[2],
            currentPosition: splitsEarthWormInfo[3],
            newPosition: newPosition
        };
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
    },
    MapWolfArrayToObject: (wolfArray) => {
        return {
            id: wolfArray[0],
            motherId: wolfArray[1],
            gender: wolfArray[2],
            movedTileIds: wolfArray[3],
            reservedTiles: wolfArray[4],
            currentPosition: wolfArray[5],
            actionId: wolfArray[6],
            lifeStatus: wolfArray[7],
            energy: wolfArray[8],
            hunger: wolfArray[9],
            growth: wolfArray[10],
            matingCount: wolfArray[11],
            matingMaxCount: wolfArray[12],
            pregnantCount: wolfArray[13],
            pregnantMaxCount: wolfArray[14],
            femaleTargetId: wolfArray[15],
            matingTargetId: wolfArray[16],
            moved: wolfArray[17],
            mapTileSightRange: wolfArray[18],
            animalTileMovableRange: wolfArray[19],
            concernedDistrictIds: wolfArray[20],
            deadCount: wolfArray[21],
            deadCountMax: wolfArray[22],
            nextActionDateTime: wolfArray[23],
            canInterfere: wolfArray[24],
            doingInteraction: wolfArray[25],
            updateTimeUnix: wolfArray[26]
        };
    },
    DefineDistrictIdByTileId: (tilePosX, tilePosY) => {
        var row = Variables.Settings.mapMinWidth / Variables.Settings.districtWidth;
        var xId = parseInt(tilePosX / Variables.Settings.districtWidth, 10);
        var yId = parseInt(tilePosY / Variables.Settings.districtHeight, 10);
        return yId * row + xId;
    },
    UpdateFecesData: (districtId, tileId, value) => {
        if(Data.Feces.DistrictData[districtId] == undefined) { Data.Feces.DistrictData[districtId] = []; }
        Data.Feces.DistrictData[districtId][tileId] = value;
    },
    AddFecesData: (districtId, tileId, kind) => {
        if(Data.Feces.DistrictData[districtId] == undefined) { Data.Feces.DistrictData[districtId] = []; }
        if(Data.Feces.DistrictData[districtId][tileId] == undefined) {
            if(kind == 'rabbit') { Data.Feces.DistrictData[districtId][tileId] = [true, false]; }
            else if(kind == 'wolf') { Data.Feces.DistrictData[districtId][tileId] = [false, true]; }
        }
        else {
            var value = Data.Feces.DistrictData[districtId][tileId];
            if(kind == 'rabbit') { value[0] = true; }
            else if(kind == 'wolf') { value[1] = true; }
            Data.Feces.DistrictData[districtId][tileId] = value;
        }
    },
    RemoveFecesData: (districtId, tileId, kind) => {
        if(Data.Feces.DistrictData[districtId] == undefined) { return; }
        if(Data.Feces.DistrictData[districtId][tileId] == undefined) { return; }
        var value = Data.Feces.DistrictData[districtId][tileId];
        if(kind == 'rabbit') { value[0] = false; }
        else if(kind == 'wolf') { value[1] = false; }
        Data.Feces.DistrictData[districtId][tileId] = value;
    }
};