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
    PrepareMapWrap: () => {
        document.body.style.overflow = 'hidden';
        const wrap = document.createElement('div');
        const wrapId = 'mapWrap';
        wrap.id = wrapId;
        wrap.setAttribute('leftTop', '0|0');
        wrap.style.position = 'absolute';
        wrap.style.left = '0px';
        wrap.style.top = '0px';
        wrap.style.overflow = 'hidden';
        wrap.style.zIndex = '0';
        document.body.appendChild(wrap);
        Core.DrawOutterLink();
        Core.DrawUsersCountDom();
        Chat.DrawChatUI();
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
    DrawUsersCountDom: () => {
        const usersDom = document.createElement('div');
        usersDom.id = 'users_count';
        usersDom.style.position = 'fixed';
        usersDom.style.left = '20px';
        usersDom.style.bottom = '15px';
        
        let html = '';
        html += '<div style="display: flex; align-items: center; gap: 5px; filter: drop-shadow(2px 2px 5px rgba(0, 0, 0, 0.5));">';
            html += '<img src="' + window.cdnPrefix + '/img/person-svgrepo-com.svg" alt="User Icon" style="width: 32px; height: 32px;" />';
            html += '<span id="connectedUserCountSpan" style="color: #FFF; font-size: 26px; font-weight: bold;">?</span>';
        html += '</div>';
        
        usersDom.innerHTML = html;
        document.body.appendChild(usersDom);
    },
    PrepareImageSources: () => {
        Images.PreloadData.unshift('environmentMap|'+Variables.ApiUrl + '/maps/' + Variables.Settings.mapId + '/live/' + Variables.Settings.mapImageUpdateId);
        Core.PrepareTreeImages();
        totalTasks = scripts.length + Images.PreloadData.length;
        Images.PreloadData.forEach((item) => {
            const splits = item.split('|');
            const keyString = splits[0];
            const url = keyString === 'environmentMap' ? splits[1] : window.cdnPrefix + splits[1];
            Images.Data[keyString] = new Image();
            Images.Data[keyString].src = url;
            Images.Data[keyString].onload = () => {
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
    PrepareTreeImages: () => {
        for (let i = 0; i < 12; i++) {
            Images.PreloadData.push('tree' + i + '|/img/tree_' + i + '_tiny.png');
        }
    },
    IfAllImagesLoaded: () => {
        if(Images.PreloadData.length === Images.LoadedCount) {
            if (completedTasks === totalTasks) { setTimeout(() => { document.getElementById("loading-screen").style.display = "none"; }, 300); }
            Core.LoadMap();
        }
    },
    AddEvents: () => {
        document.addEventListener('wheel', Core.TryScroll);
        document.addEventListener('touchstart', Core.HandleTouchStart, { passive: false });
        document.addEventListener('touchmove', Core.HandleTouchMove, { passive: false });
        document.addEventListener('touchend', Core.HandleTouchEnd);
    },
    HandleTouchStart: (event) => {
        Data.Weed.UserPaused = false;
        if (event.touches.length === 2) {
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            Variables.MapScaleInfo.mobileTouchScaleIsChanged = false;
            Variables.MapScaleInfo.mobileTouchStartDistance = Math.sqrt(
                (touch1.clientX - touch2.clientX) ** 2 + (touch1.clientY - touch2.clientY) ** 2
            );
            Variables.MapScaleInfo.mobileTouchStartCenterPosX = (touch1.clientX + touch2.clientX) / 2;
            Variables.MapScaleInfo.mobileTouchStartCenterPosY = (touch1.clientY + touch2.clientY) / 2;
        }
    },
    HandleTouchMove: (event) => {
        if (event.touches.length === 2) {
            const mapDom = document.getElementById('mapWrap');
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const currentDistance = Math.sqrt(
                (touch1.clientX - touch2.clientX) ** 2 + (touch1.clientY - touch2.clientY) ** 2
            );
            const diffDistance = currentDistance - Variables.MapScaleInfo.mobileTouchStartDistance;

            if (Math.abs(diffDistance) < 100) { return; }
            if (Variables.MapScaleInfo.current == 1 && diffDistance < 0) { return; }
            if (Variables.MapScaleInfo.current == 128 && diffDistance > 0) { return; }

            if (Variables.MapScaleInfo.mobileTouchScaleIsChanged) { return; }
            else { Variables.MapScaleInfo.mobileTouchScaleIsChanged = true; }

            let newScale = Variables.MapScaleInfo.current;
            if (diffDistance > 0) { newScale *= 2; }
            else { newScale /= 2; }

            const leftTop = Methods.GetLeftTopMapWrap(mapDom);
            if (newScale > Variables.MapScaleInfo.current) {
                Variables.MapScaleInfo.zoomPosX = Math.abs(leftTop[0]) + Variables.MapScaleInfo.mobileTouchStartCenterPosX / 2;
                Variables.MapScaleInfo.zoomPosY = Math.abs(leftTop[1]) + Variables.MapScaleInfo.mobileTouchStartCenterPosY / 2;
            }
            else {
                Variables.MapScaleInfo.zoomPosX = Math.abs(leftTop[0]) - Variables.MapScaleInfo.mobileTouchStartCenterPosX;
                Variables.MapScaleInfo.zoomPosY = Math.abs(leftTop[1]) - Variables.MapScaleInfo.mobileTouchStartCenterPosY;
            }

            const newScaleRatio = newScale / Variables.MapScaleInfo.current;
            Variables.MapScaleInfo.zoomPosX = Variables.MapScaleInfo.zoomPosX * newScaleRatio;
            Variables.MapScaleInfo.zoomPosY = Variables.MapScaleInfo.zoomPosY * newScaleRatio;

            const newLeftTop = -Variables.MapScaleInfo.zoomPosX + '|' + -Variables.MapScaleInfo.zoomPosY;
            mapDom.setAttribute('leftTop', newLeftTop);

            Core.ChangeMapScale(newScale);
        }
    },
    HandleTouchEnd: (event) => {
        Variables.MapScaleInfo.mobileTouchStartDistance = 0;
        Variables.MapScaleInfo.mobileTouchScaleIsChanged = false;
    },
    PrepareCanvas: () => {
        const canvas = document.createElement('canvas');
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        canvas.id = 'mapCanvas';
        canvas.width = windowWidth;
        canvas.height = windowHeight;
        document.getElementById('mapWrap').appendChild(canvas);
    },
    LoadMap: () => {
        Variables.MapInfo.mapImage.src = Images.Data['mapSvg'].src;
        Variables.MapInfo.mapImage.onload = function () {
            Variables.MapInfo.mapMaxWidth = Variables.MapInfo.mapImage.width;
            Variables.MapInfo.mapMaxHeight = Variables.MapInfo.mapImage.height;
            Core.DrawMap(true, false);
        };
    },
    DrawMap: (isResizing = false, isZooming = false) => {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const canvas = document.getElementById('mapCanvas');
        canvas.width = windowWidth;
        canvas.height = windowHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "#AADAFF";
        ctx.fillRect(0, 0, windowWidth, windowHeight);

        Variables.MapCanvasInfo.xPosStartOfCanvas = 0, Variables.MapCanvasInfo.yPosStartOfCanvas = 0
        Variables.MapCanvasInfo.widthOfCanvas = 0;
        Variables.MapCanvasInfo.heightOfCanvas = 0;
        const scaledMapMinWidth = Variables.MapInfo.mapMinWidth * Variables.MapScaleInfo.current;
        const scaledMapMinHeight = Variables.MapInfo.mapMinHeight * Variables.MapScaleInfo.current;

        if (windowWidth < scaledMapMinWidth && windowHeight < scaledMapMinHeight) {
            Variables.MapScaleInfo.drawMapCase = 1;
            Variables.MapCanvasInfo.widthOfCanvas = windowWidth;
            Variables.MapCanvasInfo.heightOfCanvas = windowHeight;
            Variables.MapCanvasInfo.willBringMapWidthRatio = windowWidth / scaledMapMinWidth;
            Variables.MapCanvasInfo.willBringMapHeightRatio = windowHeight / scaledMapMinHeight;
            Variables.MapCanvasInfo.bringMapWidth = Variables.MapInfo.mapImage.width * Variables.MapCanvasInfo.willBringMapWidthRatio;
            Variables.MapCanvasInfo.bringMapHeight = Variables.MapInfo.mapImage.height * Variables.MapCanvasInfo.willBringMapHeightRatio;
        }
        else if (windowWidth >= scaledMapMinWidth && windowHeight < scaledMapMinHeight) {
            Variables.MapCanvasInfo.drawMapCase = 2;
            Variables.MapCanvasInfo.willBringMapWidthRatio = 1;
            const estimatedHeightRatio = Variables.MapCanvasInfo.willBringMapWidthRatio / 16 * 9;
            const fullMapHeight = scaledMapMinWidth * estimatedHeightRatio;
            Variables.MapCanvasInfo.willBringMapHeightRatio = windowHeight / fullMapHeight;
            Variables.MapCanvasInfo.widthOfCanvas = scaledMapMinWidth;
            Variables.MapCanvasInfo.heightOfCanvas = windowHeight;
            if (windowWidth > scaledMapMinWidth) {
                Variables.MapCanvasInfo.xPosStartOfCanvas = (windowWidth - scaledMapMinWidth) / 2;
            }
            Variables.MapCanvasInfo.bringMapWidth = Variables.MapInfo.mapImage.width * Variables.MapCanvasInfo.willBringMapWidthRatio;
            Variables.MapCanvasInfo.bringMapHeight = Variables.MapInfo.mapImage.height * Variables.MapCanvasInfo.willBringMapHeightRatio;
        }
        else if (windowWidth < scaledMapMinWidth && windowHeight >= scaledMapMinHeight) {
            Variables.MapCanvasInfo.drawMapCase = 3;
            Variables.MapCanvasInfo.willBringMapHeightRatio = 1;
            const estimatedWidthRatio = Variables.MapCanvasInfo.willBringMapHeightRatio / 9 * 16;
            const fullMapWidth = scaledMapMinHeight * estimatedWidthRatio;
            Variables.MapCanvasInfo.willBringMapWidthRatio = windowWidth / fullMapWidth;
            Variables.MapCanvasInfo.heightOfCanvas = scaledMapMinHeight;
            Variables.MapCanvasInfo.widthOfCanvas = windowWidth;
            if (windowHeight > scaledMapMinHeight) {
                Variables.MapCanvasInfo.yPosStartOfCanvas = (windowHeight - scaledMapMinHeight) / 2;
            }
            Variables.MapCanvasInfo.bringMapWidth = Variables.MapInfo.mapImage.width * Variables.MapCanvasInfo.willBringMapWidthRatio;
            Variables.MapCanvasInfo.bringMapHeight = Variables.MapInfo.mapImage.height * Variables.MapCanvasInfo.willBringMapHeightRatio;
        }
        else if (windowWidth >= scaledMapMinWidth && windowHeight >= scaledMapMinHeight) {
            Variables.MapCanvasInfo.drawMapCase = 4;
            Variables.MapCanvasInfo.xPosStartOfCanvas = (windowWidth - scaledMapMinWidth) / 2;
            Variables.MapCanvasInfo.yPosStartOfCanvas = (windowHeight - scaledMapMinHeight) / 2;
            Variables.MapCanvasInfo.widthOfCanvas = scaledMapMinWidth;
            Variables.MapCanvasInfo.heightOfCanvas = scaledMapMinHeight;
            Variables.MapCanvasInfo.bringMapWidth = Variables.MapInfo.mapImage.width;
            Variables.MapCanvasInfo.bringMapHeight = Variables.MapInfo.mapImage.height;
        }
        if (isZooming) {
            Variables.MapMoveInfo.finalLeft = -Variables.MapScaleInfo.zoomPosX;
            Variables.MapMoveInfo.finalTop = -Variables.MapScaleInfo.zoomPosY;
        }
        Variables.MapCanvasInfo.xStartPos = -Variables.MapMoveInfo.finalLeft * Variables.MapScaleInfo.maxScale / Variables.MapScaleInfo.current;
        Variables.MapCanvasInfo.yStartPos = -Variables.MapMoveInfo.finalTop * Variables.MapScaleInfo.maxScale / Variables.MapScaleInfo.current;

        if (isResizing) {
            Variables.MapCanvasInfo.xEndPosLimit = -(Variables.MapInfo.mapImage.width - Variables.MapCanvasInfo.bringMapWidth) / Variables.MapScaleInfo.maxScale;
            Variables.MapCanvasInfo.yEndPosLimit = -(Variables.MapInfo.mapImage.height - Variables.MapCanvasInfo.bringMapHeight) / Variables.MapScaleInfo.maxScale;
        }

        const mapWrapDom = document.getElementById('mapWrap');
        const leftTop = Methods.GetLeftTopMapWrap(mapWrapDom);
        const domLeft = leftTop[0];
        const domTop = leftTop[1];

        let newLeft = domLeft, newTop = domTop;
        if (domLeft < Variables.MapCanvasInfo.xEndPosLimit * Variables.MapScaleInfo.current) {
            Variables.MapCanvasInfo.xStartPos = -Variables.MapCanvasInfo.xEndPosLimit * Variables.MapScaleInfo.maxScale;
            newLeft = Variables.MapCanvasInfo.xEndPosLimit * Variables.MapScaleInfo.current;

        }
        else if (domLeft >= 0) {
            Variables.MapCanvasInfo.xStartPos = 0;
            newLeft = 0;
        }

        if (domTop < Variables.MapCanvasInfo.yEndPosLimit * Variables.MapScaleInfo.current) {
            Variables.MapCanvasInfo.yStartPos = -Variables.MapCanvasInfo.yEndPosLimit * Variables.MapScaleInfo.maxScale;
            newTop = Variables.MapCanvasInfo.yEndPosLimit * Variables.MapScaleInfo.current;
        }
        else if (domTop >= 0) {
            Variables.MapCanvasInfo.yStartPos = 0;
            newTop = 0;
        }

        const newLeftTop = newLeft + '|' + newTop;
        mapWrapDom.setAttribute("leftTop", newLeftTop);

        try {
            ctx.drawImage(
                Variables.MapInfo.mapImage,
                Variables.MapCanvasInfo.xStartPos,
                Variables.MapCanvasInfo.yStartPos,
                Variables.MapCanvasInfo.bringMapWidth,
                Variables.MapCanvasInfo.bringMapHeight,
                Variables.MapCanvasInfo.xPosStartOfCanvas,
                Variables.MapCanvasInfo.yPosStartOfCanvas,
                Variables.MapCanvasInfo.widthOfCanvas,
                Variables.MapCanvasInfo.heightOfCanvas
            );
            if(Variables.MapScaleInfo.current <=4 ) {
                ctx.drawImage(
                    Images.Data.environmentMap,
                    Variables.MapCanvasInfo.xStartPos / Variables.MapScaleInfo.maxScale,
                    Variables.MapCanvasInfo.yStartPos / Variables.MapScaleInfo.maxScale,
                    Variables.MapInfo.mapMinWidth,
                    Variables.MapInfo.mapMinHeight,
                    Variables.MapCanvasInfo.xPosStartOfCanvas,
                    Variables.MapCanvasInfo.yPosStartOfCanvas,
                    Variables.MapInfo.mapMinWidth * Variables.MapScaleInfo.current,
                    Variables.MapInfo.mapMinHeight * Variables.MapScaleInfo.current,
                );
            }
            Variables.MapInfo.firstDraw = false;
            Core.ReserveDistrictInOut();
        }
        catch(e) {
            Chat.ShowRefreshIcon();
        }
    },
    RelocateWeedWrapWhenDrag: (movedX, movedY) => {
        const weedWrapDom = document.getElementById('weedWrapDom');
        const newLeft = -movedX;
        const newTop = -movedY;
        if (weedWrapDom == null) { return; }
        weedWrapDom.style.left = newLeft + 'px';
        weedWrapDom.style.top = newTop + 'px';
    },
    RelocateTreeWrapWhenDrag: (movedX, movedY) => {
        const treeWrapDom = document.getElementById('treeWrapDom');
        const newLeft = -movedX;
        const newTop = -movedY;
        if (treeWrapDom == null) { return; }
        treeWrapDom.style.left = newLeft + 'px';
        treeWrapDom.style.top = newTop + 'px';
    },
    RelocateAnimalWrapWhenDrag: (movedX, movedY) => {
        const animalWrapDom = document.getElementById('animalWrapDom');
        const newLeft = -movedX;
        const newTop = -movedY;
        if (animalWrapDom == null) { return; }
        animalWrapDom.style.left = newLeft + 'px';
        animalWrapDom.style.top = newTop + 'px';
        
        MovementProcess.TargetDomIds.clear();
    },
    RelocateShadowWrapWhenDrag: (movedX, movedY) => {
        const shadowWrapDom = document.getElementById('shadowWrapDom');
        const newLeft = -movedX;
        const newTop = -movedY;
        if (shadowWrapDom == null) { return; }
        shadowWrapDom.style.left = newLeft + 'px';
        shadowWrapDom.style.top = newTop + 'px';
        
        MovementProcess.TargetDomIds.clear();
    },
    TryScroll: (event) => {
        const chatLogDom = document.getElementById('chat_log');
        const chatUsernameDom = document.getElementById('chat_username');
        const chatMessageDom = document.getElementById('chat_message');
        if (
            (chatLogDom && chatLogDom.contains(event.target)) ||
            (chatUsernameDom && chatUsernameDom.contains(event.target)) ||
            (chatMessageDom && chatMessageDom.contains(event.target))
        ) {
            return;
        }
    
        if (event.deltaY < 0) {
            Variables.ScrollInfo.upAmount++;
            Variables.ScrollInfo.downAmount = 0;
        }
        else if (event.deltaY > 0) {
            Variables.ScrollInfo.upAmount = 0;
            Variables.ScrollInfo.downAmount++;
        }
        Variables.ScrollInfo.isScrolling = true;
        clearTimeout(Variables.TimeoutInfo.zoomMap);
        Variables.TimeoutInfo.zoomMap = setTimeout(Core.ZoomMap(event), 100);
    },
    ZoomMap: (event) => {
        const mapDom = document.getElementById('mapWrap');
        if (mapDom == null) { return; }


        let scrollDirection = '';
        if (Variables.ScrollInfo.upAmount > 0) {
            scrollDirection = 'up';
        }
        else if (Variables.ScrollInfo.downAmount > 0) {
            scrollDirection = 'down';
        }

        let newScaleList = [];
        if (scrollDirection == 'up') {
            for (let i = 0; i < Variables.MapScaleInfo.list.length; i++) {
                if (Variables.MapScaleInfo.list[i] > Variables.MapScaleInfo.current) {
                    newScaleList.push(Variables.MapScaleInfo.list[i]);
                }
            }
        }
        else if (scrollDirection == 'down') {
            for (let i = Variables.MapScaleInfo.list.length - 1; i >= 0; i--) {
                if (Variables.MapScaleInfo.list[i] < Variables.MapScaleInfo.current) {
                    newScaleList.push(Variables.MapScaleInfo.list[i]);
                }
            }
        }
        if (newScaleList.length == 0) { return; }

        if(Variables.MapScaleInfo.current != Variables.MapScaleInfo.maxScale || scrollDirection != 'up') {
            Methods.CleanPrepareWeedWrapDom();
            Methods.CleanPrepareTreeWrapDom();
        }

        let newIndex = 0;
        if (scrollDirection == 'up') {
            newIndex = Variables.ScrollInfo.upAmount - 1;
            if (newIndex > newScaleList.length - 1) { newIndex = newScaleList.length - 1; }
        }
        else if (scrollDirection == 'down') {
            newIndex = Variables.ScrollInfo.downAmount - 1;
            if (newIndex > newScaleList.length - 1) { newIndex = newScaleList.length - 1; }
        }

        const leftTop = Methods.GetLeftTopMapWrap(mapDom);
        if (scrollDirection == 'up') {
            Variables.MapScaleInfo.zoomPosX = Math.abs(leftTop[0]) + event.clientX / 2;
            Variables.MapScaleInfo.zoomPosY = Math.abs(leftTop[1]) + event.clientY / 2;
        }
        else if (scrollDirection == 'down') {
            Variables.MapScaleInfo.zoomPosX = Math.abs(leftTop[0]) - event.clientX;
            Variables.MapScaleInfo.zoomPosY = Math.abs(leftTop[1]) - event.clientY;
        }

        let newScale = newScaleList[newIndex];

        

        const newScaleRatio = newScale / Variables.MapScaleInfo.current;
        Variables.MapScaleInfo.zoomPosX = Variables.MapScaleInfo.zoomPosX * newScaleRatio;
        Variables.MapScaleInfo.zoomPosY = Variables.MapScaleInfo.zoomPosY * newScaleRatio;

        const newLeftTop = -Variables.MapScaleInfo.zoomPosX + '|' + -Variables.MapScaleInfo.zoomPosY;
        mapDom.setAttribute('leftTop', newLeftTop);

        AnimationProcess.TargetDomIds.clear();

        Core.ChangeMapScale(newScale);
        Variables.ScrollInfo.isScrolling = false;
        Variables.ScrollInfo.upAmount = 0;
        Variables.ScrollInfo.downAmount = 0;

    },
    ChangeMapScale: async (newScale) => {
        Variables.MapScaleInfo.previous = Variables.MapScaleInfo.current;
        Variables.MapScaleInfo.current = newScale;
        Data.Weed.UserPaused = true;
        Core.DrawMap(true, true);
    },
    ReserveDistrictInOut: () => {
        if (
            Variables.MapScaleInfo.previous <= 4 && 
            Variables.MapScaleInfo.current <= 4 && 
            Variables.MapInfo.viewDistrictIds.length == 0
        ) { return; }
        clearTimeout(Variables.TimeoutInfo.districtInOut);
        Variables.TimeoutInfo.districtInOut = setTimeout(Socket.UnjoinMapGroup, 100);
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
            Variables.MapInfo.mapMinWidth = Variables.Settings.mapMinWidth;
            Variables.MapInfo.mapMinHeight = Variables.Settings.mapMinHeight;
        } catch (error) {
            console.error('Error:', error);
        }
    },
    DrawDistrictWeedTileByDistrictId: (districtId) => {
        if( Data.Weed.DistrictData[districtId] == undefined || Data.Weed.UserPaused == false ) { return; }
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
            const weedWidthHeight = Images.Data.weed.height;
            const weedImagePosX = proceedId * weedWidthHeight;
            const weedImagePosY = 0;
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
        const dirtFloorWidthHeight = Images.Data.dirt_droppings.height;
        ctx.drawImage(
            Images.Data.dirt_droppings,
            imagePosInfo.posX,
            imagePosInfo.posY,
            dirtFloorWidthHeight,
            dirtFloorWidthHeight,
            posX,
            posY,
            viewSize,
            viewSize
        );
    },
    DefineDirtDroppingImagePos: (fecesData) => {
        const imageSize = Images.Data.dirt_droppings.height;
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
                accelerationIcon.style.bottom = '55px';
                accelerationIcon.style.width = '32px';
                accelerationIcon.style.height = '32px';
                accelerationIcon.style.filter = 'drop-shadow(2px 2px 5px rgba(0, 0, 0, 0.5))';
                accelerationIcon.style.zIndex = '9999';
                document.body.appendChild(accelerationIcon);
            }
        }
        else if(accelerationIcon != null) {
            accelerationIcon.parentNode.removeChild(accelerationIcon);
        }
    },
};