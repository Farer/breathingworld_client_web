'use strict';
const MovementProcess = {
    TargetDomIds: new Set(),
    MoveId: 0,
    DoingMovement: false,
    lastTimestamp: null, // For delta time calculation
    MovementData: {},
    StartMovement: () => {
        if (MovementProcess.DoingMovement) return;
        MovementProcess.DoingMovement = true;
        MovementProcess.lastTimestamp = null; // Reset timestamp
        MovementProcess.Move(); // Starts the animation loop
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
    },
    DefineTargetKindByDomId: (domId) => {
        if (domId.startsWith('rabbit')) return 'rabbit';
        if (domId.startsWith('wolf')) return 'wolf';
        return '';
    },
    /**
     * Previously, only a single start and destination was handled,
     * but now it accepts an array of waypoints (e.g., [ "324:5322", "5344:55645", ... ])
     * and stores them as a queue in Animal.Data for the given domId,
     * then sequentially moves towards each waypoint.
     *
     * @param {string} domId - The id of the DOM element to move
     * @param {string} fromPos - The starting position in the format "x:y"
     * @param {Array} waypoints - An array of coordinates in the format "x:y"
     * @param {number} speed - The movement speed in pixels per second
     */
    TriggerMovement: (domId, fromPos, waypoints, speed) => {
        const targetKind = MovementProcess.DefineTargetKindByDomId(domId);
        if (!targetKind) { return; }

        if (!MovementProcess.MovementData[domId]) { MovementProcess.MovementData[domId] = {}; }
        const data = MovementProcess.MovementData[domId];
        const fromPosSplit = fromPos.split(':').map(Number);

        // Set the current position
        data.x = fromPosSplit[0];
        data.y = fromPosSplit[1];
        data.speed = speed;

        // Store waypoints as an array (each element is an object {x, y})
        data.waypoints = waypoints.map(point => {
            const split = point.split(':').map(Number);
            return { x: split[0], y: split[1] };
        });

        // Set the first waypoint as the current target
        if (data.waypoints.length > 0) {
            const currentTarget = data.waypoints[0];
            data.targetX = currentTarget.x;
            data.targetY = currentTarget.y;

            const dx = data.targetX - data.x;
            const dy = data.targetY - data.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance === 0) {
                data.moveDx = 0;
                data.moveDy = 0;
            } else {
                // Compute directional speed (pixels per second)
                data.moveDx = (dx / distance) * speed;
                data.moveDy = (dy / distance) * speed;
            }
        }

        MovementProcess.AddTargetDomId(domId);
        MovementProcess.StartMovement();
        var targetDom = document.getElementById(domId);
        Animal.ApplyAnimalDomTransform(targetDom, Animal.Data.rabbit[domId]);
        const mapPosition = Methods.GetAnimalDomInfo(`${data.x}:${data.y}`, domId);
        DomControll.ApplyTransform(targetDom, 'translate3d', `${mapPosition.left}px, ${mapPosition.top}px, 0`);
    },
    /**
     * The Move function now uses delta time to update movement,
     * making the speed consistent regardless of frame rate.
     * This should slow down the movement if speed is reduced.
     */
    Move: (timestamp) => {
        if (!MovementProcess.lastTimestamp) {
            MovementProcess.lastTimestamp = timestamp;
        }
        let delta = (timestamp - MovementProcess.lastTimestamp) / 1000;
        const clampedDelta = Math.min(delta, 0.01);
        MovementProcess.lastTimestamp = timestamp;
    
        if (MovementProcess.TargetDomIds.size === 0) {
            MovementProcess.CancelMovement();
            return;
        }
    
        MovementProcess.TargetDomIds.forEach((domId) => {
            const data = MovementProcess.MovementData[domId];
            if (data) {
                const element = document.getElementById(domId);
                if (element) {
                    let finishedMoving = false;
                    data.x += data.moveDx * clampedDelta;
                    data.y += data.moveDy * clampedDelta;
    
                    const remainingDist = Math.sqrt(
                        (data.targetX - data.x) ** 2 + (data.targetY - data.y) ** 2
                    );
                    if (remainingDist < data.speed * clampedDelta) {
                        finishedMoving = true;
                        data.x = data.targetX;
                        data.y = data.targetY;
                        data.waypoints.shift();
    
                        if (data.waypoints.length > 0) {
                            finishedMoving = false;
                            const nextTarget = data.waypoints[0];
                            data.targetX = nextTarget.x;
                            data.targetY = nextTarget.y;
                            const dx = data.targetX - data.x;
                            const dy = data.targetY - data.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            if (distance === 0) {
                                data.moveDx = 0;
                                data.moveDy = 0;
                            } else {
                                data.moveDx = (dx / distance) * data.speed;
                                data.moveDy = (dy / distance) * data.speed;
                            }
                        }
    
                        if (finishedMoving) {
                            MovementProcess.RemoveTargetDomId(domId);
                        }
                    }
                    
                    if (!finishedMoving) {
                        const mapPosition = Methods.GetAnimalDomInfo(`${data.x}:${data.y}`, domId);
                        DomControll.ApplyTransform(element, 'translate3d', `${mapPosition.left}px, ${mapPosition.top}px, 0`);
                    } else {
                        Animal.UpdateAnimalDomAfterMoving(MovementProcess.DefineTargetKindByDomId(domId), domId, data);
                    }
                }
            }
        });
    
        MovementProcess.MoveId = requestAnimationFrame(MovementProcess.Move);
    },
};
