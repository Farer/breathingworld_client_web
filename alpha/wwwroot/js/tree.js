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
    },
    DrawDistrictTreeTileByDistrictId: (districtId) => {
        if( Data.Tree.IdsInDistrict[districtId] == undefined ) { return; }
        const mapWarpLeftTop = Methods.GetLeftTopMapWrap();
        let count = Data.Tree.IdsInDistrict[districtId].length;
        for(let i=0; i < count; i++) { 
            const treeData = Tree.Data['tree-' + Data.Tree.IdsInDistrict[districtId][i]]
            const centerTilePosX = treeData.centerPositionX * Variables.MapScaleInfo.current + mapWarpLeftTop[0];
            const centerTilePosY = treeData.centerPositionY * Variables.MapScaleInfo.current + mapWarpLeftTop[1];
            const isVisible = Tree.IfThisTreeVisible(centerTilePosX, centerTilePosY, treeData.size);
            if(isVisible) { Tree.HandleTreeDomByStat(treeData); }
        }
    },
    IfThisTreeVisible: (centerTilePosX, centerTilePosY, size) => {
        const oneTileSize = Variables.MapScaleInfo.current;
        const plusTileSize = size * oneTileSize;
        const fromXposOfTree = centerTilePosX - plusTileSize;
        const fromYposOfTree = centerTilePosY - plusTileSize;
        const toXposOfTree = centerTilePosX + oneTileSize + plusTileSize;
        const toYposOfTree = centerTilePosY + oneTileSize + plusTileSize;
        let visible = true;
        if(
            fromXposOfTree > Variables.MapCanvasInfo.widthOfCanvas - 1 ||
            fromYposOfTree > Variables.MapCanvasInfo.heightOfCanvas - 1 ||
            toXposOfTree <= 0 ||
            toYposOfTree <= 0
        ) { visible = false; }
        return visible;
    },
    GetTreeImageSource: (id) => {
        const keyId = 'tree-' + id;
        const imageId = 'tree' + Tree.Data[keyId].proceedCode;
        return Images.Data[imageId];
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

        const mapWarpLeftTop = Methods.GetLeftTopMapWrap();

        const imageFixedWidth = imageSource.width*Variables.MapScaleInfo.maxScale / 74;
        const imageFixedHeight = imageSource.height*Variables.MapScaleInfo.maxScale / 74;

        const imageWidth = imageFixedWidth * Variables.MapScaleInfo.current / Variables.MapScaleInfo.maxScale;
        const imageHeight = imageFixedHeight * Variables.MapScaleInfo.current / Variables.MapScaleInfo.maxScale;
        
        const treeDomId = 'tree-' + treeData.id;
        let treeDom = document.getElementById(treeDomId);
        if (treeDom == null) {
            treeDom = document.createElement('div');
            treeDom.id = treeDomId;
            treeDom.style.position = 'absolute';
        }
        treeDom.style.width = imageWidth + 'px';
        treeDom.style.height = imageHeight + 'px';
        treeDom.style.background = 'url(' + imageSource.src + ') no-repeat center center / contain';

        const rootCenterTilePosX = treeData.centerPositionX * Variables.MapScaleInfo.current + mapWarpLeftTop[0];
        const rootCenterTilePosY = treeData.centerPositionY * Variables.MapScaleInfo.current + mapWarpLeftTop[1];

        const rootSizeX = parseInt(treeData.size[0], 10);
        const rootSizeY = parseInt(treeData.size[1], 10);

        let plusCountY = 0;
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

        const finalLeft = rootCenterTilePosX + Variables.MapScaleInfo.current/2 - imageWidth/2;
        const finalTop = rootCenterTilePosY + Variables.MapScaleInfo.current * plusCountY - imageHeight;
        treeDom.style.left = finalLeft + 'px';
        treeDom.style.top = finalTop + 'px';
        document.getElementById('treeWrapDom').appendChild(treeDom);
    },
    RemoveDom: (id) => {
        const treeDomId = 'tree-' + id;
        const treeDom = document.getElementById(treeDomId);
        if (treeDom != null) {
            treeDom.parentNode.removeChild(treeDom);
        }
    }
};