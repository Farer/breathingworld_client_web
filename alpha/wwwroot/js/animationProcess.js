'use strict';
const AnimationProcess = {
    TargetDomIds: new Set(),
    AnimateId: 0,
    FrameDiff: 60,
    DoingAnimation: false,
    frameCount: 0,
    StartAnimation: () => {
        if (AnimationProcess.DoingAnimation) { return; }
        AnimationProcess.DoingAnimation = true;
        AnimationProcess.frameCount = 0;
        AnimationProcess.AnimateId = requestAnimationFrame(AnimationProcess.Animate);
    },
    CancelAnimation: () => {
        AnimationProcess.DoingAnimation = false;
        cancelAnimationFrame(AnimationProcess.AnimateId);
    },
    AddTargetDomId: (id) => {
        AnimationProcess.TargetDomIds.add(id);
    },
    RemoveTargetDomId: (id) => {
        AnimationProcess.TargetDomIds.delete(id);
    },
    Animate: () => {
        if (AnimationProcess.TargetDomIds.size === 0) {
            AnimationProcess.CancelAnimation();
            return;
        }
        
        AnimationProcess.frameCount++;

        AnimationProcess.TargetDomIds.forEach((domId) => {
            const targetKind = DomControll.DefineTargetKindByDomId(domId);
            if (targetKind === 'rabbit' && Animal.Data.rabbit[domId] !== undefined) {
                let divideAmount = parseInt(Animal.Data.rabbit[domId].currentActionFrameDelay / AnimationProcess.FrameDiff, 10);
                if (!divideAmount) { divideAmount = 1; }
                if (AnimationProcess.frameCount % divideAmount === 0) {
                    Animal.ContinueAnimation(
                        targetKind,
                        Animal.Data.rabbit[domId].id,
                        Animal.Data.rabbit[domId].actionIdForAnimation
                    );
                }
            }
            else if (targetKind === 'wolf' && Animal.Data.wolf[domId] !== undefined) {
                let divideAmount = parseInt(Animal.Data.wolf[domId].currentActionFrameDelay / AnimationProcess.FrameDiff, 10);
                if (!divideAmount) { divideAmount = 1; }
                if (AnimationProcess.frameCount % divideAmount === 0) {
                    Animal.ContinueAnimation(
                        targetKind,
                        Animal.Data.wolf[domId].id,
                        Animal.Data.wolf[domId].actionIdForAnimation
                    );
                }
            }
        });
        AnimationProcess.AnimateId = requestAnimationFrame(AnimationProcess.Animate);
    },
};
