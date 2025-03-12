'use strict';
const Tree = {
    Data: [],
    DecodeTreeBytes: (treesBytes) => {
        const base64Data = treesBytes;
        const decodedData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const treeInfoArray = msgpack.decode(decodedData);
        return Tree.MapTreeArrayToObject(treeInfoArray);
    },
    MapTreeArrayToObject: (treeArray) => {
        return {
            id: treeArray[0],
            centerPosition: treeArray[1],
            size: treeArray[2],
            growth: treeArray[3],
            proceedCode: treeArray[4]
        };
    },
    UpsertData: (data) => {
        const centerPositionSplit = data.centerPosition.split(':');
        const keyId = 'tree-' + data.id;
        Tree.Data[keyId] = {
            id: data.id,
            centerPosition: data.centerPosition,
            centerPositionX: parseInt(centerPositionSplit[0], 10),
            centerPositionY: parseInt(centerPositionSplit[1], 10),
            size: data.size,
            growth: data.growth,
            proceedCode: data.proceedCode
        };
        return Tree.Data[keyId];
    },
    DrawDistrictTreeTileByDistrictId: (districtId) => {
        if (!Data.Tree.IdsInDistrict[districtId]) return;
        const currentTime = Date.now();
        if ( !Data.Tree.DistrictData[districtId] || (currentTime - Data.Tree.DistrictDataUpdateTime[districtId] > Data.Tree.CacheExpireMillis) ) {
            const treesInDistrict = Data.Tree.IdsInDistrict[districtId].map(treeId => {
                return Tree.Data['tree-' + treeId];
            });
            treesInDistrict.sort((a, b) => a.centerPositionY - b.centerPositionY);
            Data.Tree.DistrictData[districtId] = treesInDistrict;
            Data.Tree.DistrictDataUpdateTime[districtId] = currentTime;
        }
        Data.Tree.DistrictData[districtId].forEach(treeData => {
            if (Tree.IfThisTreeVisible(treeData)) { Tree.HandleTreeDomByStat(treeData); }
        });
    },    
    IfThisTreeVisible: (treeData) => {
        const imageInfo = Tree.GetTreeImageInfoByCurrentScale(treeData);
        const toXposOfTree = imageInfo.left + imageInfo.width;
        const toYposOfTree = imageInfo.top + imageInfo.height;
        let visible = true;
        if(
            imageInfo.left > Variables.MapCanvasInfo.widthOfCanvas - 1 ||
            imageInfo.top > Variables.MapCanvasInfo.heightOfCanvas - 1 ||
            toXposOfTree <= 0 ||
            toYposOfTree <= 0
        ) { visible = false; }
        return visible;
    },
    GetTreeImageInfoByCurrentScale: (treeData) => {
        const imageSource = Tree.GetTreeImageSource(treeData.id);
        const imageFixedWidth = imageSource.width*Variables.MapScaleInfo.maxScale / 74;
        const imageFixedHeight = imageSource.height*Variables.MapScaleInfo.maxScale / 74;
        const imageWidth = imageFixedWidth * Variables.MapScaleInfo.current / Variables.MapScaleInfo.maxScale;
        const imageHeight = imageFixedHeight * Variables.MapScaleInfo.current / Variables.MapScaleInfo.maxScale;
        const mapWarpLeftTop = Methods.GetLeftTopMapWrap();
        const rootCenterTilePosX = treeData.centerPositionX * Variables.MapScaleInfo.current + mapWarpLeftTop[0];
        const rootCenterTilePosY = treeData.centerPositionY * Variables.MapScaleInfo.current + mapWarpLeftTop[1];
        let plusCountY = 0;
        const rootSizeX = parseInt(treeData.size[0], 10);
        const rootSizeY = parseInt(treeData.size[1], 10);
        switch(rootSizeY) {
            case 1: plusCountY = 2; break;
            case 3: plusCountY = 2; break;
            case 5: plusCountY = 3; break;
            case 6: plusCountY = 3; break;
            case 7: plusCountY = 4; break;
        }
        if(plusCountY == 0) {
            console.error('plusCountY == 0');
            return;
        }
        const left = rootCenterTilePosX + Variables.MapScaleInfo.current/2 - imageWidth/2;
        const top = rootCenterTilePosY + Variables.MapScaleInfo.current * plusCountY - imageHeight;
        return {
            width: imageWidth,
            height: imageHeight,
            left: left,
            top: top
        };
    },
    GetTreeImageSource: (id) => {
        const keyId = 'tree-' + id;
        const imageId = 'tree' + Tree.Data[keyId].proceedCode;
        return Images.Data[imageId];
    },
    GetTreePlusCountY: (rootSizeY) => {
        let plusCountY = 0;
        switch(rootSizeY) {
            case 1: plusCountY = 2; break;
            case 3: plusCountY = 2; break;
            case 5: plusCountY = 3; break;
            case 6: plusCountY = 3; break;
            case 7: plusCountY = 4; break;
        }
        return plusCountY;
    },
    HandleTreeDomByStat: (treeData) => {
        const treeWrapDom = document.getElementById('treeWrapDom');
        if (treeWrapDom == null) {
            console.error('treeWrapDom == null');
            return;
        }
        const imageSource = Tree.GetTreeImageSource(treeData.id);
        if (imageSource == null) {
            console.error('imageSource == null');
            return;
        }
        const imageInfo = Tree.GetTreeImageInfoByCurrentScale(treeData);
        const treeDomId = 'tree-' + treeData.id;
        let treeDom = document.getElementById(treeDomId);
        if (treeDom == null) {
            treeDom = document.createElement('div');
            treeDom.id = treeDomId;
            treeDom.style.position = 'absolute';
            document.getElementById('treeWrapDom').appendChild(treeDom);
        }
        treeDom.style.zIndex = treeData.centerPositionY;
        treeDom.style.width = imageInfo.width + 'px';
        treeDom.style.height = imageInfo.height + 'px';
        treeDom.style.background = 'url(' + imageSource.src + ') no-repeat center center / contain';
        treeDom.style.left = imageInfo.left + 'px';
        treeDom.style.top = imageInfo.top + 'px';

        Tree.Data[treeDomId].width = imageInfo.width;
        Tree.Data[treeDomId].height = imageInfo.height;
        Tree.Data[treeDomId].left = imageInfo.left;
        Tree.Data[treeDomId].top = imageInfo.top;

        ShadowControll.CreateShadow(treeDomId);
        ShadowControll.UpdateShadowSize(treeDomId);
        ShadowControll.UpdateShadowPosition(treeDomId);

    },
    RemoveDom: (id) => {
        const treeDomId = 'tree-' + id;
        const treeDom = document.getElementById(treeDomId);
        if (treeDom != null) {
            treeDom.parentNode.removeChild(treeDom);
        }
    }
};