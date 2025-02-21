const DomControll = {
    TransformCache: new WeakMap(),
    TransformOrder: ["translate3d", "translate", "scale", "scaleX"],
    TargetDomIds: new Set(),
    AnimateId: 0,
    frameCount: 0,
    DoingAnimation: false,
    StartProcess: () => {
        if (DomControll.DoingAnimation) { return; }
        DomControll.DoingAnimation = true;
        DomControll.AnimateId = requestAnimationFrame(DomControll.Control);
    },
    CancelAnimation: () => {
        DomControll.frameCount = 0;
        DomControll.DoingAnimation = false;
        cancelAnimationFrame(DomControll.AnimateId);
    },
    AddTargetDomId: (id) => {
        DomControll.TargetDomIds.add(id);
    },
    RemoveTargetDomId: (id) => {
        DomControll.TargetDomIds.delete(id);
    },
    DefineTargetKindByDomId: (domId) => {
        const splits = domId.split('-');
        if(splits[0] === 'rabbit') { return 'rabbit'; }
        else if(splits[0] === 'wolf') { return 'wolf'; }
        else if(splits[0] === 'tree') { return 'tree'; }
    },
    Control: () => {
        if (DomControll.TargetDomIds.size === 0) {
            DomControll.CancelAnimation();
            return;
        }
        
        DomControll.frameCount++;
        if (DomControll.frameCount % 60 !== 0) {
            DomControll.AnimateId = requestAnimationFrame(DomControll.Control);
            return;
        }

        DomControll.TargetDomIds.forEach((domId) => {
            const targetKind = DomControll.DefineTargetKindByDomId(domId);
            const targetDom = document.getElementById(domId);
            let moved = false;
            let targetData;
            if(targetKind === 'rabbit') { targetData = Animal.Data.rabbit; }
            else if(targetKind === 'wolf') { targetData = Animal.Data.wolf; }

            if (targetDom && targetData[domId] !== undefined) {
                const targetDomLeft = targetData[domId].left;
                const targetDomTop = targetData[domId].top;
                const targetDomRight = targetDomLeft + targetData[domId].width;
                const targetDomBottom = targetDomTop + targetData[domId].height;

                const treeWrap = document.getElementById('treeWrapDom');
                const treeDoms = treeWrap.getElementsByTagName('div');

                Array.from(treeDoms).forEach(treeDom => {
                    if(Tree.Data[treeDom.id] == undefined) { return; }
                    const treeLeft = Tree.Data[treeDom.id].left;
                    const treeTop = Tree.Data[treeDom.id].top;
                    const treeRight = treeLeft + Tree.Data[treeDom.id].width;
                    const treeBottom = treeTop + Tree.Data[treeDom.id].height;

                    if (targetDomBottom > treeBottom && targetDomTop < treeBottom && targetDomRight > treeLeft && targetDomLeft < treeRight) {
                        targetDom.style.zIndex = treeDom.style.zIndex;
                        treeDom.parentNode.appendChild(targetDom);
                        moved = true;
                    }
                });
            }

            if (!moved && targetDom && targetDom.style && targetDom.style.zIndex !== '') {
                targetDom.style.zIndex = '';
                document.getElementById('animalWrapDom').appendChild(targetDom);
            }
        });
        DomControll.AnimateId = requestAnimationFrame(DomControll.Control);
    },
    ApplyTransform: (element, property, value) => {
        if (!element) { return; }
        let transforms = DomControll.TransformCache.get(element) || new Map();
        const stringValue = typeof value === "number" ? value.toString() : value;
        transforms.set(property, stringValue);
        let transformString = "";
        DomControll.TransformOrder.forEach(key => {
            if (transforms.has(key)) {
                transformString += `${key}(${transforms.get(key)}) `;
            }
        });
        transforms.forEach((val, key) => {
            if (!DomControll.TransformOrder.includes(key)) {
                transformString += `${key}(${val}) `;
            }
        });
        element.style.transform = transformString.trim();
        DomControll.TransformCache.set(element, transforms);
    },
    RemoveTransform: (element, property) => {
        if (!element) { return; }
        let transforms = DomControll.TransformCache.get(element);
        if (!transforms) { return; }
        transforms.delete(property);
        let transformString = "";
        DomControll.TransformOrder.forEach(key => {
            if (transforms.has(key)) {
                transformString += `${key}(${transforms.get(key)}) `;
            }
        });
        transforms.forEach((val, key) => {
            if (!DomControll.TransformOrder.includes(key)) {
                transformString += `${key}(${val}) `;
            }
        });
        element.style.transform = transformString.trim();
        DomControll.TransformCache.set(element, transforms);
    }
};
