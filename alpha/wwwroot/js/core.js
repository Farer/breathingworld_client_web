'use strict';
const Core = {
    SetUrls: (selectedRegion) => {
        const urlPrefix = selectedRegion != 'kr' ? selectedRegion+'-' : '';
        const urlParams = new URLSearchParams(window.location.search);
        Variables.ApiUrl = urlParams.get('api') || 'https://api.breathingworld.com';
        Variables.SocketUrl = urlParams.get('socket') || 'https://'+urlPrefix+'api.breathingworld.com';
        Variables.ChatUrl = urlParams.get('chat') || 'https://chat.breathingworld.com';
    },
    DrawLocationSelectionMenu: () => {
        const menuContainer = document.createElement('div');
        menuContainer.id = 'locationSelectionMenu';
        menuContainer.style.position = 'fixed';
        menuContainer.style.top = '0';
        menuContainer.style.left = '0';
        menuContainer.style.width = '100%';
        menuContainer.style.height = '100%';
        menuContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        menuContainer.style.display = 'flex';
        menuContainer.style.justifyContent = 'center';
        menuContainer.style.alignItems = 'center';
        menuContainer.style.zIndex = '10000';

        const menuBox = document.createElement('div');
        menuBox.id = 'menuBox';
        menuBox.style.backgroundColor = '#fff';
        menuBox.style.padding = '20px';
        menuBox.style.borderRadius = '10px';
        menuBox.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        menuBox.style.display = 'flex';
        menuBox.style.flexDirection = 'column';
        menuBox.style.alignItems = 'center';
        menuBox.style.width = '300px';

        const title = document.createElement('h2');
        title.textContent = 'Select Your Region';
        title.style.marginBottom = '20px';
        menuBox.appendChild(title);

        const regions = ['North America', 'Europe', 'Asia Pacific', 'South Korea'];
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'buttonContainer';
        menuBox.appendChild(buttonContainer);

        regions.forEach(region => {
            const button = document.createElement('button');
            button.textContent = region;
            button.className = 'regionButton';
            button.addEventListener('click', () => {
                var regionValue = '';
                switch(region) {
                    case 'North America': regionValue = 'us'; break;
                    case 'Europe': regionValue = 'eu'; break;
                    case 'Asia Pacific': regionValue = 'ap'; break;
                    case 'South Korea': regionValue = 'kr'; break;
                }
                localStorage.setItem('selectedRegion', regionValue);
                menuContainer.style.display = 'none';
                window.location.reload();
            });
            buttonContainer.appendChild(button);
        });

        menuContainer.appendChild(menuBox);
        document.body.appendChild(menuContainer);
    },
    PrepareMapContainer: () => {
        const dom = document.createElement('div');
        const domId = 'mapContainer';
        dom.id = domId;
        dom.style.position = 'relative';
        dom.style.overflow = 'hidden';
        dom.style.zIndex = '0';
        dom.style.width = '100vw';
        dom.style.height = '100vh';
        document.body.appendChild(dom);
        Variables.Doms.set(domId, dom);
    },
    PrepareMapWrap: () => {
        const wrap = document.createElement('div');
        const wrapId = 'mapWrap';
        wrap.id = wrapId;
        Variables.MapViewPort.x = 0;
        Variables.MapViewPort.y = 0;
        wrap.style.position = 'absolute';
        wrap.style.left = '0px';
        wrap.style.top = '0px';
        wrap.style.overflow = 'hidden';
        wrap.style.zIndex = '0';
        wrap.style.width = '100vw';
        wrap.style.height = '100vh';
        const mapContainer = Variables.Doms.get('mapContainer');
        mapContainer.appendChild(wrap);
        Variables.Doms.set(wrapId, wrap);
    },
    PrepareWeatherWrap: () => {
        const wrap = document.createElement('div');
        const wrapId = 'weatherWrap';
        wrap.id = wrapId;
        wrap.style.position = 'absolute';
        wrap.style.left = '0px';
        wrap.style.top = '0px';
        wrap.style.overflow = 'hidden';
        wrap.style.zIndex = '1';
        wrap.style.pointerEvents = 'none';
        const mapContainer = Variables.Doms.get('mapContainer');
        mapContainer.appendChild(wrap);
    },
    DrawOutterLink: () => {
        const discordDom = document.createElement('div');
        discordDom.id = 'discord_link';
        discordDom.style.position = 'fixed';
        discordDom.style.right = '100px';
        discordDom.style.top = '12px';
        discordDom.style.width = '30px';

        const filterShadowStyle = ' filter: drop-shadow(2px 2px 5px rgba(0, 0, 0, 0.5));';
    
        let html = '';
        html += '<div class="external-links-container" id="externalLinksContainer" style="position: fixed; top: 20px; right: 20px; display: flex; gap: 25px;">';
            html += '<div id="locationIcon" style="cursor: pointer; display: block;">';
                html += '<img src="' + window.cdnPrefix + '/img/icon_location.svg" alt="Location" style="width: 30px; height: 30px; ' + filterShadowStyle + '">';
            html += '</div>';
            html += '<a href="https://api.breathingworld.com/" target="_blank" style="display: block;">';
                html += '<img src="' + window.cdnPrefix + '/img/graph-bar.svg" alt="Dashboard" style="width: 30px; height: 30px; '+filterShadowStyle+'">';
            html += '</a>';
            html += '<a href="https://blog.breathingworld.com/" target="_blank" style="display: block;">';
                html += '<img src="' + window.cdnPrefix + '/img/icon_blog.svg" alt="Blog" style="width: 30px; height: 30px; '+filterShadowStyle+'">';
            html += '</a>';
            html += '<a href="https://github.com/Farer/breathingworld_client_web" target="_blank" style="display: block;">';
                html += '<img src="' + window.cdnPrefix + '/img/github-mark-white.svg" alt="Github" style="width: 30px; height: 30px; '+filterShadowStyle+'">';
            html += '</a>';
            html += '<a href="https://www.reddit.com/r/BreathingWorld/" target="_blank" style="display: block;">';
                html += '<img src="' + window.cdnPrefix + '/img/icon_reddit_950_tiny.png" alt="Reddit" style="width: 30px; height: 30px; '+filterShadowStyle+'">';
            html += '</a>';
            html += '<a href="https://x.com/FarerBW" target="_blank" style="display: block;">';
                html += '<img src="' + window.cdnPrefix + '/img/icon_twitter.svg" alt="Twitter" style="width: 30px; height: 30px; '+filterShadowStyle+'">';
            html += '</a>';
            html += '<a href="https://discord.gg/4Y2TpWDtJm" target="_blank" style="display: block;">';
                html += '<img src="' + window.cdnPrefix + '/img/icon_clyde_white_RGB.svg" alt="Discord" style="width: 30px; height: 30px; '+filterShadowStyle+'">';
            html += '</a>';
        html += '</div>';
        
        discordDom.innerHTML = html;
        document.body.appendChild(discordDom);
    
        const mainLinkDom = document.createElement('div');
        mainLinkDom.id = 'main_link';
        mainLinkDom.style.position = 'fixed';
        mainLinkDom.style.left = '20px';
        mainLinkDom.style.top = '24px';
        html = '';
        html += '<a href="https://breathingworld.com/" style=" '+filterShadowStyle+' color: #FFF; font-size: 24px; font-weight: bold; text-decoration: none">';
            html += 'Breathing World';
        html += '</a>';
        mainLinkDom.innerHTML = html;
        document.body.appendChild(mainLinkDom);

        const selectLocationDom = document.createElement('div');
        selectLocationDom.id = 'selectLocationDom';
        selectLocationDom.style.position = 'absolute';
        selectLocationDom.style.display = 'none';
        selectLocationDom.style.textAlign = 'right';
        html = '';
        html += '<select id="locationSelect" style="position: absolute; background-color: #333; color: #FFF; border: 1px solid #555; padding: 5px; font-size: 16px; ' + filterShadowStyle + '">';
            html += '<option value="us">North America</option>';
            html += '<option value="eu">Europe</option>';
            html += '<option value="ap">Asia Pacific</option>';
            html += '<option value="kr">South Korea</option>';
        html += '</select>';
        selectLocationDom.innerHTML = html;
        document.body.appendChild(selectLocationDom);
    
        const moreButton = document.createElement('div');
        moreButton.id = 'more_button';
        moreButton.innerHTML = '<img src="' + window.cdnPrefix + '/img/more-horizontal-svgrepo-com.svg" alt="more" style="width: 34px; height: 34px; '+filterShadowStyle+'">';
        moreButton.style.position = 'fixed';
        moreButton.style.right = '20px';
        moreButton.style.top = '20px';
        moreButton.style.cursor = 'pointer';
        document.body.appendChild(moreButton);
    
        const externalLinksContainer = document.querySelector('.external-links-container');
        const locationIcon = document.getElementById('locationIcon');

        const updateVisibility = () => {
            if (window.innerWidth <= 768) {
                externalLinksContainer.style.display = 'none';
                externalLinksContainer.style.flexDirection = 'column';
                externalLinksContainer.style.top = '72px';
                externalLinksContainer.style.right = '19px';
                moreButton.style.display = 'block';
            } else {
                externalLinksContainer.style.display = 'flex';
                externalLinksContainer.style.flexDirection = 'row';
                externalLinksContainer.style.top = '20px';
                moreButton.style.display = 'none';
                selectLocationDom.style.display = 'none';
            }
        };

        updateVisibility();
        window.addEventListener('resize', () => {
            updateVisibility();
            selectLocationDom.style.display = 'none';
        });
    
        moreButton.addEventListener('click', () => {
            if (externalLinksContainer.style.display === 'none') {
                externalLinksContainer.style.display = 'flex';
                moreButton.innerHTML = '<img src="' + window.cdnPrefix + '/img/close-svgrepo-com.svg" alt="close" style="width: 34px; height: 34px; '+filterShadowStyle+'">';
            } else {
                externalLinksContainer.style.display = 'none';
                moreButton.innerHTML = '<img src="' + window.cdnPrefix + '/img/more-horizontal-svgrepo-com.svg" alt="more" style="width: 34px; height: 34px; '+filterShadowStyle+'">';
            }
        });

        
        locationIcon.addEventListener('click', (event) => {
            event.stopPropagation();
            selectLocationDom.style.display = 'block';
            const locationIconRect = locationIcon.getBoundingClientRect();
            const selectLocationWidth = document.getElementById('locationSelect').offsetWidth;
            selectLocationDom.style.left = (locationIconRect.right - selectLocationWidth) + 'px';
            selectLocationDom.style.top = locationIconRect.top + 'px';
        });
        
        var locationSelectDom = document.getElementById('locationSelect');
        locationSelectDom.value = localStorage.getItem('selectedRegion');
        locationSelectDom.addEventListener('change', (event) => {
            var selectedValue = event.target.value;
            localStorage.setItem('selectedRegion', selectedValue);
            document.location.reload();
        });

        document.addEventListener('click', (event) => {
            if (!selectLocationDom.contains(event.target)) {
                selectLocationDom.style.display = 'none';
            }
        });

        selectLocationDom.addEventListener('change', () => {
            selectLocationDom.style.display = 'none';
        });
    },
    UpdateWeekProgressBar: () => {
        const dayId = Variables.Settings.dayId || 1;
        const { monthIndex, day } = Methods.GetMonthAndDayByDayId(dayId);
        const monthName = Variables.MonthNames[monthIndex - 1];
        
        let dateContainer = document.getElementById('dateContainer');
        if (!dateContainer) {
            dateContainer = document.createElement('div');
            dateContainer.id = 'dateContainer';
            dateContainer.style.position = 'fixed';
            dateContainer.style.left = '30px';
            dateContainer.style.top = '70px';
            dateContainer.style.height = '20px';
            dateContainer.style.display = 'flex';
            dateContainer.style.alignItems = 'center';
            dateContainer.style.gap = '4px';
            
            const dateLabel = document.createElement('div');
            dateLabel.id = 'dateLabel';
            dateLabel.style.color = 'rgba(255, 255, 255, 0.8)';
            dateLabel.style.fontSize = '11px';
            dateLabel.style.fontWeight = '500';
            dateLabel.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.3)';
            dateLabel.style.lineHeight = '1';
            dateLabel.style.whiteSpace = 'nowrap';
            
            dateContainer.appendChild(dateLabel);
            document.body.appendChild(dateContainer);
        }
        
        const dateLabel = document.getElementById('dateLabel');
        const currentHour = parseInt(Variables.Settings.hourId, 10);
        const amPm = currentHour < 12 ? 'AM' : 'PM';
        const hour = currentHour % 12 || 12;
        if (dateLabel) {
            dateLabel.textContent = `${day} ${monthName} · ${hour} ${amPm} `;
        }
    },
    DrawUsersCountDom: () => {
        const usersDom = document.createElement('div');
        usersDom.id = 'users_count';
        usersDom.style.position = 'fixed';
        usersDom.style.left = '20px';
        usersDom.style.bottom = '10px';
        
        let html = '';
        html += '<div style="display: flex; align-items: center; gap: 5px; filter: drop-shadow(2px 2px 5px rgba(0, 0, 0, 0.5));">';
            html += '<img src="' + window.cdnPrefix + '/img/icon_eye.svg" alt="viewers icon" style="width: 32px; height: 32px;" />';
            html += '<span id="connectedUserCountSpan" style="color: #FFF; font-size: 26px; font-weight: bold;">?</span>';
        html += '</div>';
        
        usersDom.innerHTML = html;
        document.body.appendChild(usersDom);
    },
    PrepareImageSources: () => {
        Images.PreloadData.unshift('environmentMap|'+Variables.ApiUrl + '/maps/' + Variables.Settings.mapId + '/live/' + Variables.Settings.mapImageUpdateId);
        totalTasks = scripts.length + Images.PreloadData.length;
        Images.PreloadData.forEach((item) => {
            const splits = item.split('|');
            const keyString = splits[0];
            const url = keyString === 'environmentMap' ? splits[1] : window.cdnPrefix + splits[1];
            Images.Data[keyString] = new Image();
            Images.Data[keyString].src = url;
            Images.Data[keyString].onload = async () => {
                Core.OnLoadErrorImage();
            };
            Images.Data[keyString].onerror = () => {
                Core.OnLoadErrorImage();
            };
        });
    },
    OnLoadErrorImage: () => {
        updateProgress();
        Images.LoadedCount++;
        Core.IfAllImagesLoaded();
    },
    IfAllImagesLoaded: () => {
        if(Images.PreloadData.length === Images.LoadedCount) {
            if (completedTasks === totalTasks) { setTimeout(() => { document.getElementById("loading-screen").style.display = "none"; }, 300); }
            Object.keys(Images.Data).forEach(key => { Images.Data[key].onload = null; });
        }
    },
    PrepareMapCanvas: () => {
        const canvas = document.createElement('div');
        const domId = 'mapCanvas';
        canvas.id = domId;
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.background = '#aadaff';
        const mapWrap = Variables.Doms.get('mapWrap');
        mapWrap.appendChild(canvas);
        Variables.Doms.set(domId, canvas);
    },
    PrepareWebGlDom: () => {
        const dom = document.createElement('div');
        const domId = 'webGlDom';
        dom.id = domId;
        dom.style.position = "absolute";
        dom.style.left = "0px";
        dom.style.top = "0px";
        dom.style.width = '100vw';
        dom.style.height = '100vh';
        dom.style.pointerEvents = "none";
        const mapWrap = Variables.Doms.get('mapWrap');
        mapWrap.appendChild(dom);
        Variables.Doms.set(domId, dom);
    },
    GetSettings: async () => {
        try {
            const response = await fetch(Variables.ApiUrl + '/settings/base', {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            Variables.Settings = await response.json();
            Variables.Settings.weekId = Methods.GetWeekIdByDayId(Variables.Settings.dayId);
            const weatherInfo = Methods.ParseWeatherInfo(Variables.Settings.weatherInfo);
            Variables.Settings.weatherInfo = weatherInfo.info;
            Variables.Settings.temperature = weatherInfo.temperature;
            Variables.MapInfo.mapMinWidth = Variables.Settings.mapMinWidth;
            Variables.MapInfo.mapMinHeight = Variables.Settings.mapMinHeight;
        } catch (error) {
            console.error('Error:', error);
        }
    },
    ManageEarthWormCache: (districtId, mapIndex, info) => {
        try {
            if (!(Data.EarthWorm.DistrictData instanceof Map)) {
                Data.EarthWorm.DistrictData = new Map();
                Data.EarthWorm.DistrictData.set(districtId, new Map());
            }
            const previousData = Data.EarthWorm.DistrictData.has(districtId) ? Data.EarthWorm.DistrictData.get(districtId) : new Map();
            previousData.set(mapIndex, info);
            Data.EarthWorm.DistrictData.set(districtId, previousData);
        }
        catch(error) {
            console.error('ManageEarthWormCache');
            console.log(error);
        }
    },
    HandleEarthWormByInfo: (districtId, info) => {
        const parsedInfo = Methods.ParseEarthWormInfo(info);
        const mapPosition = Methods.GetMapPositionByAnimalPositionIndex(parsedInfo.currentPosition);

        const mapIndex = Methods.GetMapIndexByMapPosition(mapPosition.x, mapPosition.y);
        Core.ManageEarthWormCache(districtId, mapIndex, info);

        const animalPosition = Methods.GetAnimalPositionByIndex(parsedInfo.currentPosition);
        const realPosition = Methods.GetAnimalRealPosition(animalPosition);
        if(!Core.IfThisTileVisible(mapPosition.x, mapPosition.y)) { return; }
        const exist = Variables.EarthWormController.hasWorm(parsedInfo.id);
        if(exist == false) {
            if(parsedInfo.status == '-1') {

            }
            else if(parsedInfo.status == '0') {
                Variables.EarthWormController.emergeWorm(parsedInfo.id, {x: realPosition.left, y: realPosition.top});
            }
            else if(parsedInfo.status == '1') {
                Variables.EarthWormController.emergeWorm(parsedInfo.id, {x: realPosition.left, y: realPosition.top});
                setTimeout(() => {
                    const targetRealPosition = Methods.GetAnimalRealPosition(Methods.GetAnimalPositionByIndex(parsedInfo.newPosition));
                    Variables.EarthWormController.moveWorm(parsedInfo.id, targetRealPosition.left, targetRealPosition.top);
                }, 1000);
            }
            else if(parsedInfo.status == '2') {

            }
            else if(parsedInfo.status == '3') {
                Variables.EarthWormController.addWorm(parsedInfo.id, {x: realPosition.left, y: realPosition.top});
                Variables.EarthWormController.killWorm(parsedInfo.id);
            }
        }
        else {
            if(parsedInfo.status == '-1') {
                Variables.EarthWormController.burrowWorm(parsedInfo.id);
            }
            else if(parsedInfo.status == '0') {
                // do nothing
            }
            else if(parsedInfo.status == '1') {
                const targetRealPosition = Methods.GetAnimalRealPosition(Methods.GetAnimalPositionByIndex(parsedInfo.newPosition));
                Variables.EarthWormController.moveWorm(parsedInfo.id, targetRealPosition.left, targetRealPosition.top);
            }
            else if(parsedInfo.status == '2') {
                Variables.EarthWormController.burrowWorm(parsedInfo.id);
            }
            else if(parsedInfo.status == '3') {
                Variables.EarthWormController.killWorm(parsedInfo.id);
            }
        }
    },
    DrawDistrictEarthWormTileByDistrictId: (districtId) => {
        if (!(Data.EarthWorm.DistrictData instanceof Map)) { return; }
        const mapTileData = Data.EarthWorm.DistrictData.get(districtId);
        for (const wormInfo of mapTileData.values()) {
            Core.HandleEarthWormByInfo(districtId, wormInfo);
        }
    },
    DrawDistrictWeedTileByDistrictId: (districtId) => {
        if( Data.Weed.DistrictData[districtId] == undefined || Data.UserPaused == false ) { return; }
        const mapWarpLeftTop = Methods.GetLeftTopMapWrap();
        for(let tileId in Data.Weed.DistrictData[districtId]) {
            const tileIdSplit = tileId.split(':');
            const xPos = parseInt(tileIdSplit[0], 10) * Variables.MapScaleInfo.current + mapWarpLeftTop[0];
            const yPos = parseInt(tileIdSplit[1], 10) * Variables.MapScaleInfo.current + mapWarpLeftTop[1];
            const isVisible = Core.IfThisWeedTileVisible(xPos, yPos);
            const weedStatus = Data.Weed.DistrictData[districtId][tileId];
            let fecesData = [false, false];
            if(Data.Feces.DistrictData[districtId] != undefined && Data.Feces.DistrictData[districtId][tileId] != undefined) {
                fecesData = Data.Feces.DistrictData[districtId][tileId];
            }
            const rabbitFecesExists = fecesData[0];
            const wolfFecesExists = fecesData[1];
            if(isVisible) { Core.HandleWeedTileByStat(xPos, yPos, weedStatus, rabbitFecesExists, wolfFecesExists); }
        }
    },
    UpdateOneWeedTile: (districtId, tileId) => {
        const tileIdSplit = tileId.split(':');
        const mapWarpLeftTop = Methods.GetLeftTopMapWrap();
        const xPos = parseInt(tileIdSplit[0], 10) * Variables.MapScaleInfo.current + mapWarpLeftTop[0];
        const yPos = parseInt(tileIdSplit[1], 10) * Variables.MapScaleInfo.current + mapWarpLeftTop[1];
        const isVisible = Core.IfThisWeedTileVisible(xPos, yPos);
        const weedStatus = Data.Weed.DistrictData[districtId][tileId];
        const fecesData = Data.Feces.DistrictData[districtId][tileId];
        const rabbitFecesExists = fecesData[0];
        const wolfFecesExists = fecesData[1];
        if(isVisible) { Core.HandleWeedTileByStat(xPos, yPos, weedStatus, rabbitFecesExists, wolfFecesExists); }
    },
    UpdateOneWeedTileByFeces: (districtId, tileId, fecesExists, kind) => {
        if(Data.Weed.DistrictData[districtId] == undefined || Data.Weed.DistrictData[districtId][tileId] == undefined) { return; }
        
        const tileIdSplit = tileId.split(':');
        const mapWarpLeftTop = Methods.GetLeftTopMapWrap();
        const xPos = parseInt(tileIdSplit[0], 10) * Variables.MapScaleInfo.current + mapWarpLeftTop[0];
        const yPos = parseInt(tileIdSplit[1], 10) * Variables.MapScaleInfo.current + mapWarpLeftTop[1];
        const isVisible = Core.IfThisWeedTileVisible(xPos, yPos);
        if(isVisible == false) { return; }

        if(Data.Feces.DistrictData[districtId] == undefined) { Data.Feces.DistrictData[districtId] = []; }
        Data.Feces.DistrictData[districtId][tileId] = [false, false];
        if(kind=="rabbit") { Data.Feces.DistrictData[districtId][tileId][0] = fecesExists; }
        else if(kind=="wolf") { Data.Feces.DistrictData[districtId][tileId][1] = fecesExists; }

        const weedStatus = Data.Weed.DistrictData[districtId][tileId];
        var fecesData = Data.Feces.DistrictData[districtId][tileId];
        Core.HandleWeedTileByStat(xPos, yPos, weedStatus, fecesData[0], fecesData[1]);
    },
    IfThisTileVisible: (xPos, yPos) => {
        const currentScale = Variables.MapScaleInfo.current;
        const canvasWidth = Variables.MapCanvasInfo.widthOfCanvas;
        const canvasHeight = Variables.MapCanvasInfo.heightOfCanvas;
        const realXpos = xPos * currentScale;
        const realYpos = yPos * currentScale;
        const mapContainerLeftTop = Methods.GetLeftTopMapWrap();
        const viewportX = -mapContainerLeftTop[0];
        const viewportY = -mapContainerLeftTop[1];
        const tileRight = realXpos + currentScale;
        const tileBottom = realYpos + currentScale;
        const viewportRight = viewportX + canvasWidth;
        const viewportBottom = viewportY + canvasHeight;
        if (
            realXpos >= viewportRight ||
            tileRight <= viewportX ||
            realYpos >= viewportBottom ||
            tileBottom <= viewportY
        ) {
            return false;
        }
        return true;
    },
    IfThisWeedTileVisible: (xPos, yPos) => {
        const weedTileSize = Variables.MapScaleInfo.current;
        const rightEdgePosOfTile = xPos + weedTileSize;
        const bottomEdgePosOfTile = yPos + weedTileSize;
        let visible = true;
        if(
            xPos > Variables.MapCanvasInfo.widthOfCanvas - 1 ||
            yPos > Variables.MapCanvasInfo.heightOfCanvas - 1 ||
            rightEdgePosOfTile <= 0 ||
            bottomEdgePosOfTile <= 0
        ) { visible = false; }
        return visible;
    },
    HandleWeedTileByStat: (posX, posY, proceedId, rabbitFecesExists, wolfFecesExists) => {
        const weedWrapDom = document.getElementById('weedWrapDom');
        if (weedWrapDom == null) { return; }
        
        const ctx = document.getElementById('weedCanvas').getContext('2d');
        const viewSize = Variables.MapScaleInfo.current;

        Core.DrawDirtFloorOnTile(ctx, posX, posY, viewSize, [rabbitFecesExists, wolfFecesExists]);
        
        if( proceedId != -1) {
            const weedWidthHeight = 512;
            const cols = 4;
            const weedImagePosX = (proceedId % cols) * weedWidthHeight;
            const weedImagePosY = Math.floor(proceedId / cols) * weedWidthHeight;
            ctx.drawImage(
                Images.Data.weed,
                weedImagePosX,
                weedImagePosY,
                weedWidthHeight,
                weedWidthHeight,
                posX,
                posY,
                viewSize,
                viewSize
            );
        }
    },
    DrawDirtFloorOnTile: (ctx, posX, posY, viewSize, fecesData) => {
        const weedWrapDom = document.getElementById('weedWrapDom');
        if (weedWrapDom == null) { return; }
        const imagePosInfo = Core.DefineDirtDroppingImagePos(fecesData);
        ctx.clearRect(posX, posY, viewSize, viewSize);
        ctx.drawImage(
            Images.Data['sprite_ground'],
            imagePosInfo.posX,
            imagePosInfo.posY,
            Variables.DirtFloorWidthHeight,
            Variables.DirtFloorWidthHeight,
            posX,
            posY,
            viewSize,
            viewSize
        );
    },
    DefineDirtDroppingImagePos: (fecesData) => {
        const imageSize = Variables.DirtFloorWidthHeight;
        const rabbitFecesExists = fecesData[0];
        const wolfFecesExists = fecesData[1];
        let caseId = 0;
        if(rabbitFecesExists && !wolfFecesExists) { caseId = 1; }
        else if(!rabbitFecesExists && wolfFecesExists) { caseId = 2; }
        else if(rabbitFecesExists && wolfFecesExists) { caseId = 3; }
        return {
            posX: caseId * imageSize,
            posY: 0
        }
    },
    UpdatePlantProceedAccelerated: () => {
        const accelerationIconId = 'plantAccelerationIcon';
        let accelerationIcon = document.getElementById(accelerationIconId);
        if(Variables.Settings.plantProceedAccelerated) {
            if(accelerationIcon == null) {
                accelerationIcon = document.createElement('img');
                accelerationIcon.id = accelerationIconId;
                accelerationIcon.src = Images.Data['icon_weed'].src;
                accelerationIcon.style.position = 'absolute';
                accelerationIcon.style.left = '20px';
                accelerationIcon.style.bottom = '53px';
                accelerationIcon.style.width = '32px';
                accelerationIcon.style.height = '32px';
                accelerationIcon.style.filter = 'drop-shadow(2px 2px 5px rgba(0, 0, 0, 0.5))';
                document.body.appendChild(accelerationIcon);
            }
        }
        else if(accelerationIcon != null) {
            accelerationIcon.parentNode.removeChild(accelerationIcon);
        }
        Core.UpdateWeekProgressBar();
    },
    ApplyWeather: () => {
        // "1|200|5|2"
        if(Variables.Settings.weatherInfo != undefined) {
            const split = Variables.Settings.weatherInfo.split("|");
            const modeValue = split[0];
            if(split[0] != "0") {
                /*
                Methods.ShowWeather('weatherCanvas', 'rain', { intensity: 200, speed: 5, wind: 2 });
                Methods.ShowWeather('weatherCanvas', 'snow', { intensity: 150, speed: 1, wind: -1 });
                Methods.ShowWeather('weatherCanvas', 'mixed', { intensity: 300, speed: 3, wind: 1 });
                */
                let mode = "rain";
                if(modeValue == "2") { mode = "snow"; }
                else if(modeValue == "3") { mode = "mixed"; }
                Methods.ShowWeather('weatherCanvas', mode, { intensity: split[1], speed: split[2], wind: split[3] });
            }
            else {
                Methods.StopWeather();
            }
        }
    }
};