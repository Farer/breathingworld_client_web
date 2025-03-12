'use strict';
const MovementProcess = {
    TargetDomIds: new Set(),
    MovementData: {},
    ShadowMovementData: {},
    FrameRateAdjustment: 16,

    ResetMovementData: () => {
        MovementProcess.TargetDomIds.clear();
        MovementProcess.MovementData = {};
        MovementProcess.ShadowMovementData = {};
    },

    CancelMovement: (domId) => {
        const data = MovementProcess.MovementData[domId];
        if (data && data.animation) {
            data.animation.cancel();
            MovementProcess.RemoveTargetDomId(domId);
        }
    },

    AddTargetDomId: (id) => {
        MovementProcess.TargetDomIds.add(id);
    },

    RemoveTargetDomId: (id) => {
        MovementProcess.TargetDomIds.delete(id);
        delete MovementProcess.MovementData[id];
    },

    DefineTargetKindByDomId: (domId) => {
        if (domId.startsWith('rabbit')) return 'rabbit';
        if (domId.startsWith('wolf')) return 'wolf';
        return '';
    },

    TriggerMovement: (domId, waypoints, speed) => {
        const targetKind = MovementProcess.DefineTargetKindByDomId(domId);
        if (!targetKind || waypoints.length < 2) {
            MovementProcess.RemoveTargetDomId(domId);
            return;
        }
    
        const element = document.getElementById(domId);
        if (!element) {
            MovementProcess.RemoveTargetDomId(domId);
            return;
        }
    
        if (MovementProcess.MovementData[domId] && MovementProcess.MovementData[domId].animation) {
            MovementProcess.CancelMovement(domId);
        }
    
        MovementProcess.MovementData[domId] = {
            domId,
            element,
            originalWayPoints: [...waypoints],
            speed: speed,
        };
    
        let transforms = DomControll.TransformCache.get(element) || new Map();
    
        const animalData = Animal.Data[targetKind][domId];
        if (animalData && !transforms.has('scale')) {
            const maxGrowth = Variables.Settings.animalMaxGrowthForScale;
            const growth = Math.min(Math.max(animalData.growth || 5, 5), maxGrowth);
            const scale = (1 / maxGrowth * growth);
            DomControll.ApplyTransform(element, 'scale', scale);
            transforms = DomControll.TransformCache.get(element);
        }
    
        const direction = element.getAttribute('movingDirection');
        if (!transforms.has('scaleX') || transforms.get('scaleX') !== (direction === 'right' ? '-1' : '1')) {
            const scaleX = direction === 'right' ? -1 : (direction === 'left' ? 1 : transforms.get('scaleX') || 1);
            DomControll.ApplyTransform(element, 'scaleX', scaleX);
            transforms = DomControll.TransformCache.get(element);
        }
    
        if (!transforms.has('translate3d')) {
            const initialPos = Methods.GetAnimalDomInfo(waypoints[0], domId);
            DomControll.ApplyTransform(element, 'translate3d', `${initialPos.left}px, ${initialPos.top}px, 0`);
            transforms = DomControll.TransformCache.get(element);
        }
    
        let totalDistance = 0;
        for (let i = 1; i < waypoints.length; i++) {
            const [x1, y1] = waypoints[i - 1].split(':').map(Number);
            const [x2, y2] = waypoints[i].split(':').map(Number);
            const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            totalDistance += distance;
        }

        const speedValue = MovementProcess.MovementData[domId].speed;
        const totalDuration = Math.max(totalDistance / speedValue * 1000, 100);
    
        const shadowDomId = `shadow-${domId}`;
        const shadowElement = ShadowControll.ShadowElements[shadowDomId];
        const shadowKeyframes = waypoints.map(point => {
            var positionInfo = ShadowControll.CalculateShadowPositionInfo(domId, point);
            return { transform: `translate3d(${positionInfo.x}px, ${positionInfo.y}px, 0)` };
        });
        const shadowAnimationOptions = {
            duration: totalDuration,
            easing: 'linear',
            fill: 'forwards',
        };
        const shadowAnimation = shadowElement.animate(shadowKeyframes, shadowAnimationOptions);
        MovementProcess.ShadowMovementData[domId] = shadowAnimation;
    
        const keyframes = waypoints.map(point => {
            const mapPosition = Methods.GetAnimalDomInfo(point, domId);
            if (!mapPosition || typeof mapPosition.left === 'undefined' || typeof mapPosition.top === 'undefined') {
                console.error('Invalid mapPosition for', point, mapPosition);
                return { transform: transforms.get('translate3d') || 'translate3d(0px, 0px, 0)' };
            }
    
            const updatedTransforms = new Map(transforms);
            updatedTransforms.set('translate3d', `${mapPosition.left}px, ${mapPosition.top}px, 0`);
    
            let transformString = "";
            DomControll.TransformOrder.forEach(key => {
                if (updatedTransforms.has(key)) {
                    transformString += `${key}(${updatedTransforms.get(key)}) `;
                }
            });
            updatedTransforms.forEach((val, key) => {
                if (!DomControll.TransformOrder.includes(key)) {
                    transformString += `${key}(${val}) `;
                }
            });
    
            return { transform: transformString.trim() };
        });
    
        const animation = element.animate(keyframes, {
            duration: totalDuration,
            easing: 'linear',
            fill: 'forwards',
        });
    
        MovementProcess.MovementData[domId].animation = animation;
        MovementProcess.AddTargetDomId(domId);
    
        // Handle animation finish
        animation.onfinish = () => {
            const data = MovementProcess.MovementData[domId];
            if (data) {
                const finalMapPosition = Methods.GetAnimalDomInfo(waypoints[waypoints.length - 1], domId);
                DomControll.ApplyTransform(element, 'translate3d', `${finalMapPosition.left}px, ${finalMapPosition.top}px, 0`);
                const finalDirection = element.getAttribute('movingDirection');
                if (finalDirection) {
                    const scaleX = finalDirection === 'right' ? -1 : 1;
                    DomControll.ApplyTransform(element, 'scaleX', scaleX);
                }
                Animal.UpdateAnimalDomAfterMoving(targetKind, domId, {
                    x: parseInt(waypoints[waypoints.length - 1].split(':')[0]),
                    y: parseInt(waypoints[waypoints.length - 1].split(':')[1]),
                });
                MovementProcess.RemoveTargetDomId(domId);
            }
            // Finish shadow animation
            if (MovementProcess.ShadowMovementData[domId]) {
                ShadowControll.UpdateShadowSize(domId);
                ShadowControll.UpdateShadowPosition(domId);
                MovementProcess.ShadowMovementData[domId].finish();
                delete MovementProcess.ShadowMovementData[domId];
            }
        };
    
        // Handle animation cancel
        animation.oncancel = () => {
            MovementProcess.RemoveTargetDomId(domId);
            // Cancel shadow animation
            if (MovementProcess.ShadowMovementData[domId]) {
                MovementProcess.ShadowMovementData[domId].cancel();
                delete MovementProcess.ShadowMovementData[domId];
            }
        };
    },
};