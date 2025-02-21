'use strict';
const MovementProcess = {
    TargetDomIds: new Set(),
    MoveId: 0,
    DoingMovement: false,
    MovementData: {},
    FrameRateAdjustment: 16,
    LastFrameTime: 0,
    StartMovement: () => {
        if (MovementProcess.DoingMovement) return;
        MovementProcess.DoingMovement = true;
        MovementProcess.Move();
    },
    CancelMovement: () => {
        MovementProcess.DoingMovement = false;
        cancelAnimationFrame(MovementProcess.MoveId);
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
        if (!targetKind || waypoints.length < 2 || !MovementProcess.PrepareMove(domId, waypoints, speed)) { MovementProcess.RemoveTargetDomId(domId); return; }
        MovementProcess.AddTargetDomId(domId);
        MovementProcess.StartMovement();
    },
    PrepareMove: (domId, waypoints, speed) => {
        MovementProcess.MovementData[domId] = {};
        const data = MovementProcess.MovementData[domId];
        data.domId = domId;
        data.element = document.getElementById(domId);
        data.originalWayPoints = [...waypoints];
        data.speed = speed / 1000;
        data.waypoints = waypoints.map(point => {
            const split = point.split(':').map(Number);
            return { x: split[0], y: split[1] };
        });

        if(!MovementProcess.PrepareData(data)) { return false; }

        var targetDom = document.getElementById(domId);
        Animal.ApplyAnimalDomTransform(targetDom, Animal.Data.rabbit[domId]);
        const mapPosition = Methods.GetAnimalDomInfo(`${data.x}:${data.y}`, domId);
        DomControll.ApplyTransform(targetDom, 'translate3d', `${mapPosition.left}px, ${mapPosition.top}px, 0`);
        return true;
    },
    PrepareData: (data) => {
        const fromPos = data.waypoints.shift();
        data.x = fromPos.x;
        data.y = fromPos.y;

        data.fromX = fromPos.x;
        data.fromY = fromPos.y;

        const toPos = data.waypoints.shift();
        data.toX = toPos.x;
        data.toY = toPos.y;
        
        data.toXDirection = data.fromX < data.toX ? '+' : data.fromX > data.toX ? '-' : '';
        data.toYDirection = data.fromY < data.toY ? '+' : data.fromY > data.toY ? '-' : '';

        const dx = data.toX - data.fromX;
        const dy = data.toY - data.fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance === 0) {
            console.log('distance is 0');
            if(data.waypoints.length > 0) {
                data.waypoints.unshift(toPos);
                console.log('continue next point');
                return MovementProcess.PrepareData(data);
            }
            else {
                console.log('finish moving');
                MovementProcess.RemoveTargetDomId(data.domId);
                return false;
            }
        }
        else {
            data.movingDx = (dx / distance) * data.speed;
            data.movingDy = (dy / distance) * data.speed;
        }
        return true;
    },
    Move: () => {
        if (MovementProcess.TargetDomIds.size === 0) {
            MovementProcess.CancelMovement();
            return;
        }
    
        const now = performance.now();
        MovementProcess.LastFrameTime = now;
    
        MovementProcess.TargetDomIds.forEach((domId) => {
            const data = MovementProcess.MovementData[domId];
            if (data && data.element) {
                const isArrivedToPos = MovementProcess.IfArrivedAtNextPoint(data);
                const finishedMoving = isArrivedToPos && data.waypoints.length == 0;
                if (!finishedMoving) {
                    const mapPosition = Methods.GetAnimalDomInfo(`${data.x}:${data.y}`, domId);
                    DomControll.ApplyTransform(data.element, 'translate3d', `${mapPosition.left}px, ${mapPosition.top}px, 0`);
                    if (isArrivedToPos) {
                        if (!MovementProcess.PrepareData(data)) {
                            console.log('MovementProcess.Move : data error ! Cancel movement of this.');
                            console.log(data);
                            MovementProcess.RemoveTargetDomId(domId);
                            return;
                        }
                    }
                } else {
                    MovementProcess.RemoveTargetDomId(domId);
                    Animal.UpdateAnimalDomAfterMoving(MovementProcess.DefineTargetKindByDomId(domId), domId, data);
                }
            } else {
                MovementProcess.RemoveTargetDomId(domId);
                return;
            }
        });
    
        MovementProcess.MoveId = requestAnimationFrame(MovementProcess.Move);
    },
    IfArrivedAtNextPoint: (data) => {
        data.x += data.movingDx;
        data.y += data.movingDy;

        let arrivedX = (data.toXDirection === '' || 
            (data.toXDirection === '+' && data.x >= data.toX) ||
            (data.toXDirection === '-' && data.x <= data.toX));

        let arrivedY = (data.toYDirection === '' || 
            (data.toYDirection === '+' && data.y >= data.toY) ||
            (data.toYDirection === '-' && data.y <= data.toY));

        if (arrivedX && arrivedY) {
            data.x = data.toX;
            data.y = data.toY;
            return true;
        }
        return false;
    }
};
