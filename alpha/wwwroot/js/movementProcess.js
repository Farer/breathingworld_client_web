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
    SetDestination: (domId, fromX, fromY, toX, toY, speed) => {
        const targetKind = MovementProcess.DefineTargetKindByDomId(domId);
        if (!targetKind || !Animal.Data[targetKind]) return;

        if (!Animal.Data[targetKind][domId]) {
            Animal.Data[targetKind][domId] = {};
        }
        const data = Animal.Data[targetKind][domId];

        // 출발점 & 도착점 설정
        data.x = fromX;
        data.y = fromY;
        data.targetX = toX;
        data.targetY = toY;

        // 이동 벡터 계산
        const dx = toX - fromX;
        const dy = toY - fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) {
            data.moveDx = 0;
            data.moveDy = 0;
        } else {
            data.moveDx = (dx / distance) * speed;
            data.moveDy = (dy / distance) * speed;
        }

        data.moveFrameCount = 0;
        data.moveFrameDelay = 1;

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
                const divideAmount = Math.max(1, Math.floor(data.moveFrameDelay / MovementProcess.FrameDiff));
                if (data.moveFrameCount % divideAmount === 0) {
                    const element = document.getElementById(domId);
                    if (element) {
                        data.x += data.moveDx;
                        data.y += data.moveDy;

                        // 목표 도착 여부 체크
                        const remainingDist = Math.sqrt(
                            (data.targetX - data.x) ** 2 + (data.targetY - data.y) ** 2
                        );

                        if (remainingDist < Math.abs(data.moveDx) + Math.abs(data.moveDy)) {
                            data.x = data.targetX;
                            data.y = data.targetY;
                            MovementProcess.RemoveTargetDomId(domId);
                        }

                        // GPU 가속 적용
                        DomControll.ApplyTransform(element, 'translate3d', `${data.x}px, ${data.y}px, 0`);
                    }
                }
                data.moveFrameCount++;
            }
        });

        MovementProcess.MoveId = requestAnimationFrame(MovementProcess.Move);
    },
};