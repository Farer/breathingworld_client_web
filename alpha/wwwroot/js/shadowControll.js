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
            shadowElement.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
            shadowElement.style.borderRadius = '50%';
            shadowElement.style.pointerEvents = 'none';
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
            const domKind = MovementProcess.DefineTargetKindByDomId(domId);
            const animalData = Animal.Data[domKind][domId];
            const targetDom = document.getElementById(domId);
            const transform = DomControll.TransformCache.get(targetDom);
            const scale = transform && transform.has('scale') ? transform.get('scale') : 1;
            let width = ( animalData.width - animalData.width / 10 * 6 ) * scale ;
            if(domKind=='wolf') { width *= 1.8; }
            const height = width / 5 * 2;
            shadowElement.style.width = width+'px';
            shadowElement.style.height = height+'px';
        }
    },
    UpdateShadowPosition: (domId) => {
        const targetDom = document.getElementById(domId);
        const shadowDomId = `shadow-${domId}`;
        const shadowElement = ShadowControll.ShadowElements[shadowDomId];
        if (!targetDom || !shadowElement) { return; }

        const speciesName = MovementProcess.DefineTargetKindByDomId(domId);
        const animalData = Animal.Data[speciesName][domId];
        if (!animalData) { return; }

        const currentPosition = animalData.position; // 동물의 현재 위치 가져오기
        const positionInfo = ShadowControll.CalculateShadowPositionInfo(domId, currentPosition);
        shadowElement.style.transform = `translate3d(${positionInfo.x}px, ${positionInfo.y}px, 0)`;
    },
    CalculateShadowPositionInfo: (domId, point) => {
        const targetDom = document.getElementById(domId);
        const shadowDomId = `shadow-${domId}`;
        const shadowElement = ShadowControll.ShadowElements[shadowDomId];
        if (!targetDom || !shadowElement) { return; }

        const animalData = Animal.Data[MovementProcess.DefineTargetKindByDomId(domId)][domId];

        const transform = DomControll.TransformCache.get(targetDom);
        const scale = transform.has('scale') ? transform.get('scale') : 1;

        let animalDomWidth, animalDomHeight, animalDomLeft, animalDomTop;
        if(point == undefined) {
            animalDomWidth = animalData.width;
            animalDomHeight = animalData.height;
            animalDomLeft = animalData.left;
            animalDomTop = animalData.top;
        }
        else {
            const animalDomPosition = Methods.GetAnimalDomInfo(point, domId);
            animalDomWidth = animalDomPosition.size;
            animalDomHeight = animalDomPosition.size;
            animalDomLeft = animalDomPosition.left;
            animalDomTop = animalDomPosition.top;
        }
        
        const animalDomRealWidth = animalDomWidth * scale;
        const animalDomRealHeight = animalDomHeight * scale;

        const animalDomWidthDiff = animalDomWidth - animalDomRealWidth;
        const animalDomHeightDiff = animalDomWidth - animalDomRealHeight;

        const shadowWidth = parseFloat(shadowElement.style.width);
        const shadowHeight = parseFloat(shadowElement.style.height);

        const shadowX = animalDomLeft + animalDomWidthDiff / 2 + animalDomRealWidth / 2 - shadowWidth / 2;
        const shadowY = animalDomTop + animalDomHeightDiff /2 + animalDomRealHeight - shadowHeight;

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