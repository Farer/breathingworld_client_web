'use strict';
const MovementProcess = {
    TargetDomIds: new Set(),
    MoveId: 0,
    FrameDiff: 20,
    DoingMovement: false,
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
    },
    DefineTargetKindByDomId: (domId) => {
        if (domId.startsWith('rabbit')) return 'rabbit';
        if (domId.startsWith('wolf')) return 'wolf';
        return '';
    },
    /**
     * Previously, only a single start and destination was handled,
     * but now it accepts an array of waypoints (e.g., [ [324,5322], [5344,55645], ... ])
     * and stores them as a queue in Animal.Data for the given domId,
     * then sequentially moves towards each waypoint.
     *
     * @param {string} domId - The id of the DOM element to move
     * @param {number} fromX - The starting X coordinate
     * @param {number} fromY - The starting Y coordinate
     * @param {Array} waypoints - An array of coordinates (each element is either [x, y] or an object {x, y})
     * @param {number} speed - The movement speed
     */
    TriggerMovement: (domId, fromX, fromY, waypoints, speed) => {
        const targetKind = MovementProcess.DefineTargetKindByDomId(domId);
        if (!targetKind || !Animal.Data[targetKind]) return;

        if (!Animal.Data[targetKind][domId]) {
            Animal.Data[targetKind][domId] = {};
        }
        const data = Animal.Data[targetKind][domId];

        // Set the current position
        data.x = fromX;
        data.y = fromY;
        data.speed = speed;

        // Store waypoints as an array (each element is an object {x, y})
        data.waypoints = waypoints.map(point => {
            return Array.isArray(point) ? { x: point[0], y: point[1] } : point;
        });

        // Initialize frame-related properties
        data.moveFrameCount = 0;
        data.moveFrameDelay = 1;

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
                data.moveDx = (dx / distance) * speed;
                data.moveDy = (dy / distance) * speed;
            }
        }

        MovementProcess.AddTargetDomId(domId);
        MovementProcess.StartMovement();
    },
    Move: () => {
        if (MovementProcess.TargetDomIds.size === 0) {
            MovementProcess.CancelMovement();
            return;
        }

        MovementProcess.TargetDomIds.forEach((domId) => {
            const targetKind = MovementProcess.DefineTargetKindByDomId(domId);
            const data = Animal.Data[targetKind]?.[domId];
            if (data) {
                // Process movement based on frame delay
                const divideAmount = Math.max(1, Math.floor(data.moveFrameDelay / MovementProcess.FrameDiff));
                if (data.moveFrameCount % divideAmount === 0) {
                    const element = document.getElementById(domId);
                    if (element) {
                        // Move towards the current target
                        data.x += data.moveDx;
                        data.y += data.moveDy;

                        // Check if the current target waypoint has been reached
                        const remainingDist = Math.sqrt(
                            (data.targetX - data.x) ** 2 + (data.targetY - data.y) ** 2
                        );

                        // If the remaining distance is less than one step, consider it reached
                        if (remainingDist < Math.abs(data.moveDx) + Math.abs(data.moveDy)) {
                            // Correct the position to the exact target
                            data.x = data.targetX;
                            data.y = data.targetY;
                            
                            // Remove the reached waypoint from the front of the queue
                            data.waypoints.shift();

                            if (data.waypoints.length > 0) {
                                // If there is another waypoint, set it as the new target
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
                            } else {
                                // If all waypoints have been visited, remove the element from targets
                                MovementProcess.RemoveTargetDomId(domId);
                            }
                        }

                        // Apply transform for GPU acceleration
                        DomControll.ApplyTransform(element, 'translate3d', `${data.x}px, ${data.y}px, 0`);
                    }
                }
                data.moveFrameCount++;
            }
        });

        MovementProcess.MoveId = requestAnimationFrame(MovementProcess.Move);
    },
};
