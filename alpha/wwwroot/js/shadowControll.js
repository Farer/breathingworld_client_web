const ShadowControll = {
    ShadowElements: {},
    CreateShadow: (domId) => {
        if (!document.getElementById(domId)) {
            console.log('not exist domId: ' + domId)
            return;
        }
        const shadowDomId = `shadow-${domId}`;
        let shadowElement = document.getElementById(shadowDomId);
        if(!shadowElement) {
            shadowElement = document.createElement('div');
            shadowElement.id = shadowDomId;
            shadowElement.className = 'shadow';
            shadowElement.style.position = 'absolute';
            shadowElement.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
            shadowElement.style.borderRadius = '50%';
            shadowElement.style.pointerEvents = 'none';
            const domKind = DomControll.DefineTargetKindByDomId(domId)
            if(domKind == 'rabbit' || domKind == 'wolf') { shadowElement.style.boxShadow = '0 0 7px 3px rgba(0, 0, 0, 0.08)'; }
            else if(domKind == 'tree') { shadowElement.style.boxShadow = '0 0 10px 7px rgba(0, 0, 0, 0.08)'; }
            const container = document.getElementById('shadowWrapDom');
            container.appendChild(shadowElement);
        }
        ShadowControll.ShadowElements[shadowDomId] = shadowElement;
        ShadowControll.UpdateShadowSize(domId);
        ShadowControll.UpdateShadowPosition(domId);
    },
    UpdateShadowSize: (domId) => {
        const shadowDomId = `shadow-${domId}`;
        const shadowElement = ShadowControll.ShadowElements[shadowDomId];
        if(shadowElement) {
            const domKind = DomControll.DefineTargetKindByDomId(domId);
            
            const targetDom = document.getElementById(domId);
            const transform = DomControll.TransformCache.get(targetDom);
            const scale = transform && transform.has('scale') ? transform.get('scale') : 1;
            let width = 0;
            let height = 0;;
            if(domKind=='rabbit' || domKind=='wolf') {
                const animalData = Animal.Data[domKind][domId];
                width = ( animalData.width - animalData.width / 10 * 5 ) * scale ;
                if(domKind=='wolf') { width *= 1.8; }
            }
            else if(domKind == 'tree') {
                const treeData = Tree.Data[domId];
                const treeSize = treeData.size[0];
                width = treeData.width / 100 * 8 * treeSize;
            }
            height = width / 5 * 2;
            shadowElement.style.width = width+'px';
            shadowElement.style.height = height+'px';
        }
    },
    UpdateShadowPosition: (domId) => {
        const targetDom = document.getElementById(domId);
        const shadowDomId = `shadow-${domId}`;
        const shadowElement = ShadowControll.ShadowElements[shadowDomId];
        if (!targetDom || !shadowElement) { return; }

        const targetDomKind = DomControll.DefineTargetKindByDomId(domId);
        let data = null;
        let positionInfo = null;
        if(targetDomKind=='rabbit' || targetDomKind=='wolf') {
            data = Animal.Data[targetDomKind][domId];
            if (!data) { return; }
            positionInfo = ShadowControll.CalculateShadowPositionInfo(domId, data.position);
        }
        else if(targetDomKind == 'tree') {
            positionInfo = ShadowControll.CalculateShadowPositionInfo(domId);
        }
        
        shadowElement.style.transform = `translate3d(${positionInfo.x}px, ${positionInfo.y}px, 0)`;
    },
    CalculateShadowPositionInfo: (domId, point) => {
        const targetDom = document.getElementById(domId);
        const shadowDomId = `shadow-${domId}`;
        const shadowElement = ShadowControll.ShadowElements[shadowDomId];
        if (!targetDom || !shadowElement) { return; }

        let domData = null;
        const domKind = DomControll.DefineTargetKindByDomId(domId);
        if(domKind=='rabbit' || domKind=='wolf') { domData = Animal.Data[domKind][domId]; }
        else if(domKind == 'tree') { domData = Tree.Data[domId]; }

        const transform = DomControll.TransformCache.get(targetDom);
        const scale = transform && transform.has('scale') ? transform.get('scale') : 1;

        let domWidth, domHeight, domLeft, domTop;
        if(point == undefined) {
            domWidth = domData.width;
            domHeight = domData.height;
            domLeft = domData.left;
            domTop = domData.top;
        }
        else {
            const domPosition = Methods.GetAnimalDomInfo(point, domId);
            domWidth = domPosition.size;
            domHeight = domPosition.size;
            domLeft = domPosition.left;
            domTop = domPosition.top;
        }
        
        const domRealWidth = domWidth * scale;
        const domRealHeight = domHeight * scale;

        const domWidthDiff = domWidth - domRealWidth;
        const domHeightDiff = domWidth - domRealHeight;

        const shadowWidth = parseFloat(shadowElement.style.width);
        const shadowHeight = parseFloat(shadowElement.style.height);

        const shadowX = domLeft + domWidthDiff / 2 + domRealWidth / 2 - shadowWidth / 2;
        let shadowY = domTop + domHeightDiff /2 + domRealHeight - shadowHeight;

        if(domKind == 'wolf') {
            shadowY += shadowHeight / 100 * 20;
        }
        else if(domKind == 'tree') {
            if(domData.size[0] == 3) { shadowY += shadowHeight / 100 * 15; }
            else if(domData.size[0] == 5) { shadowY += shadowHeight / 100 * 25; }
            else if(domData.size[0] == 7) { shadowY += shadowHeight / 100 * 15; }
            else if(domData.size[0] == 9) { shadowY += shadowHeight / 100 * 15; }
            else if(domData.size[0] == 11) { shadowY += shadowHeight / 100 * 15; }
        }

        return {x: shadowX, y: shadowY};
    },
    RemoveShadow: (domId) => {
        const shadowDomId = `shadow-${domId}`;
        const shadowElement = ShadowControll.ShadowElements[shadowDomId];
        if (shadowElement) {
            shadowElement.remove();
            delete ShadowControll.ShadowElements[shadowDomId];
        }
    }
};