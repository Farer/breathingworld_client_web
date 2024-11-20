'use strict';
const AnimationProcess = {
    TargetDomIds: [],
    AnimateId: 0,
    MoveId: 0,
    FrameDiff: 20,
    DoingAnimation: false,
    StartAnimation: () => {
        if(AnimationProcess.DoingAnimation) { return; }
        AnimationProcess.DoingAnimation = true;
        AnimationProcess.AnimateId = requestAnimationFrame(AnimationProcess.Animate);
    },
    CancelAnimation: () => {
        AnimationProcess.DoingAnimation = false;
        cancelAnimationFrame(AnimationProcess.AnimateId);
    },
    AddTargetDomId: (id) => {
        if(!AnimationProcess.TargetDomIds.includes(id)) {
            AnimationProcess.TargetDomIds.push(id);
        }
    },
    RemoveTargetDomId: (id) => {
        if(AnimationProcess.TargetDomIds.includes(id)) {
            const valueIndex = AnimationProcess.TargetDomIds.indexOf(id);
            if (valueIndex !== -1) { AnimationProcess.TargetDomIds.splice(valueIndex, 1); }
        }
    },
    DefineTargetKindByDomId: (domId) => {
        let targetKind = '';
        const splits = domId.split('-');
        if(splits[0] == 'weedTile') { targetKind = 'weed'; }
        else if(splits[0] == 'rabbit') { targetKind = 'rabbit'; }
        else if(splits[0] == 'wolf') { targetKind = 'wolf'; }
        return targetKind;
    },
    Animate: () => {
        if(AnimationProcess.TargetDomIds.length == 0) {
            AnimationProcess.CancelAnimation();
            return;
        }
        
        AnimationProcess.TargetDomIds.forEach((domId) => {
            const targetKind = AnimationProcess.DefineTargetKindByDomId(domId);
            if(targetKind=='rabbit' && Animal.Data.rabbit[domId] != undefined) {
                const divideAmount = parseInt(Animal.Data.rabbit[domId].currentActionFrameDelay / AnimationProcess.FrameDiff, 10);
                if(AnimationProcess.AnimateId % divideAmount == 0) {
                    Animal.ContinueAnimation(targetKind, Animal.Data.rabbit[domId].id, Animal.Data.rabbit[domId].actionIdForAnimation);
                }
            }
            else if(targetKind=='wolf' && Animal.Data.wolf[domId] != undefined) {
                const divideAmount = parseInt(Animal.Data.wolf[domId].currentActionFrameDelay / AnimationProcess.FrameDiff, 10);
                if(AnimationProcess.AnimateId % divideAmount == 0) {
                    Animal.ContinueAnimation(targetKind, Animal.Data.wolf[domId].id, Animal.Data.wolf[domId].actionIdForAnimation);
                }
            }
        });
        AnimationProcess.AnimateId = requestAnimationFrame(AnimationProcess.Animate);
    },
    Move: () => {
        if(AnimationProcess.TargetDomIds.length == 0) {
            cancelAnimationFrame(AnimationProcess.MoveId);
            return;
        }
        AnimationProcess.MoveId = requestAnimationFrame(AnimationProcess.Move);
    },
};