const DomControll = {
    TargetDomIds: [],
    AnimateId: 0,
    frameCount: 0,
    DoingAnimation: false,
    StartAnimation: () => {
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
        if (!DomControll.TargetDomIds.includes(id)) {
            DomControll.TargetDomIds.push(id);
        }
    },
    RemoveTargetDomId: (id) => {
        const index = DomControll.TargetDomIds.indexOf(id);
        if (index !== -1) { DomControll.TargetDomIds.splice(index, 1); }
    },
    DefineTargetKindByDomId: (domId) => {
        const splits = domId.split('-');
        return splits[0] === 'rabbit' ? 'rabbit' : splits[0] === 'tree' ? 'tree' : '';
    },
    Control: () => {
        if (DomControll.TargetDomIds.length === 0) {
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
            const rabbitDom = document.getElementById(domId);
            let moved = false;

            if (targetKind === 'rabbit' && rabbitDom && Animal.Data.rabbit[domId] !== undefined) {
                const rabbitLeft = Animal.Data.rabbit[domId].left;
                const rabbitTop = Animal.Data.rabbit[domId].top;
                const rabbitRight = rabbitLeft + Animal.Data.rabbit[domId].width;
                const rabbitBottom = rabbitTop + Animal.Data.rabbit[domId].height;

                const treeWrap = document.getElementById('treeWrapDom');
                const treeDoms = treeWrap.getElementsByTagName('div');

                Array.from(treeDoms).forEach(treeDom => {
                    if(Tree.Data[treeDom.id] == undefined) { return; }
                    const treeLeft = Tree.Data[treeDom.id].left;
                    const treeTop = Tree.Data[treeDom.id].top;
                    const treeRight = treeLeft + Tree.Data[treeDom.id].width;
                    const treeBottom = treeTop + Tree.Data[treeDom.id].height;

                    if (rabbitBottom > treeTop && rabbitTop < treeBottom && rabbitRight > treeLeft && rabbitLeft < treeRight) {
                        rabbitDom.style.zIndex = treeDom.style.zIndex;
                        treeDom.parentNode.appendChild(rabbitDom);
                        moved = true;
                    }
                });
            }

            if (!moved && rabbitDom.style && rabbitDom.style.zIndex !== '') {
                rabbitDom.style.zIndex = '';
                document.getElementById('animalWrapDom').appendChild(rabbitDom);
            }
        });
        DomControll.AnimateId = requestAnimationFrame(DomControll.Control);
    }
};
