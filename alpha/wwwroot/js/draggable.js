'use strict';
function AddDragMapEvent() {
    let getDataDebounceTimer = null;
    const element = document.getElementById('mapWrap');
    element.addEventListener('mousedown', TriggerMouseDown);
    element.addEventListener('touchstart', TriggerTouchStart, { passive: false });

    function TriggerMouseDown(e) {
        e.preventDefault();
        Data.Weed.UserPaused = false;
        const leftTop = Methods.GetLeftTopMapWrap(element);
        Variables.MapMoveInfo.currentLeft = leftTop[0];
        Variables.MapMoveInfo.currentTop = leftTop[1];
        Variables.MapMoveInfo.currentPosX = e.clientX;
        Variables.MapMoveInfo.currentPosY = e.clientY;
        Variables.MapMoveInfo.movedPosX = 0;
        Variables.MapMoveInfo.movedPosY = 0;
        document.addEventListener('mouseup', RemoveDragMapEvent);
        document.addEventListener('mousemove', DoingMouseDrag);
    }

    function TriggerTouchStart(e) {
        Data.Weed.UserPaused = false;
        e.preventDefault();
        if (e.touches.length === 1) {
            const leftTop = Methods.GetLeftTopMapWrap(element);
            Variables.MapMoveInfo.currentLeft = leftTop[0];
            Variables.MapMoveInfo.currentTop = leftTop[1];
            Variables.MapMoveInfo.currentPosX = e.touches[0].clientX;
            Variables.MapMoveInfo.currentPosY = e.touches[0].clientY;
            Variables.MapMoveInfo.movedPosX = 0;
            Variables.MapMoveInfo.movedPosY = 0;
            document.addEventListener('touchend', RemoveDragMapEvent);
            document.addEventListener('touchmove', DoingTouchDrag, { passive: false });
        }
    }

    function DoingMouseDrag(e) {
        Data.Weed.UserPaused = false;
        Variables.UserDragged = true;
        e.preventDefault();

        Variables.MapMoveInfo.movedPosX = Variables.MapMoveInfo.currentPosX - e.clientX;
        Variables.MapMoveInfo.movedPosY = Variables.MapMoveInfo.currentPosY - e.clientY;

        const newLeft = Variables.MapMoveInfo.currentLeft - Variables.MapMoveInfo.movedPosX;
        const newTop = Variables.MapMoveInfo.currentTop - Variables.MapMoveInfo.movedPosY;

        Variables.MapMoveInfo.finalLeft = newLeft;
        Variables.MapMoveInfo.finalTop = newTop;

        Core.RelocateWeedWrapWhenDrag(Variables.MapMoveInfo.movedPosX, Variables.MapMoveInfo.movedPosY);
        Core.RelocateTreeWrapWhenDrag(Variables.MapMoveInfo.movedPosX, Variables.MapMoveInfo.movedPosY);
        Core.RelocateAnimalWrapWhenDrag(Variables.MapMoveInfo.movedPosX, Variables.MapMoveInfo.movedPosY);
        Core.RelocateShadowWrapWhenDrag(Variables.MapMoveInfo.movedPosX, Variables.MapMoveInfo.movedPosY);
        AnimationProcess.TargetDomIds.clear();

        element.setAttribute('leftTop', newLeft + '|' + newTop);

        Core.DrawMap();
    }

    function DoingTouchDrag(e) {
        Data.Weed.UserPaused = false;
        Variables.UserDragged = true;
        e.preventDefault();
        if (e.touches.length === 1) {
            Variables.MapMoveInfo.movedPosX = Variables.MapMoveInfo.currentPosX - e.touches[0].clientX;
            Variables.MapMoveInfo.movedPosY = Variables.MapMoveInfo.currentPosY - e.touches[0].clientY;

            const newLeft = Variables.MapMoveInfo.currentLeft - Variables.MapMoveInfo.movedPosX;
            const newTop = Variables.MapMoveInfo.currentTop - Variables.MapMoveInfo.movedPosY;

            Variables.MapMoveInfo.finalLeft = newLeft;
            Variables.MapMoveInfo.finalTop = newTop;

            Core.RelocateWeedWrapWhenDrag(Variables.MapMoveInfo.movedPosX, Variables.MapMoveInfo.movedPosY);
            Core.RelocateTreeWrapWhenDrag(Variables.MapMoveInfo.movedPosX, Variables.MapMoveInfo.movedPosY);
            Core.RelocateAnimalWrapWhenDrag(Variables.MapMoveInfo.movedPosX, Variables.MapMoveInfo.movedPosY);
            Core.RelocateShadowWrapWhenDrag(Variables.MapMoveInfo.movedPosX, Variables.MapMoveInfo.movedPosY);
            AnimationProcess.TargetDomIds.clear();

            element.setAttribute('leftTop', newLeft + '|' + newTop);

            Core.DrawMap();
        }
    }

    function RemoveDragMapEvent() {
        document.removeEventListener('mouseup', RemoveDragMapEvent);
        document.removeEventListener('mousemove', DoingMouseDrag);
        document.removeEventListener('touchend', RemoveDragMapEvent);
        document.removeEventListener('touchmove', DoingTouchDrag);
        if(getDataDebounceTimer !== null) { clearTimeout(getDataDebounceTimer); }
        getDataDebounceTimer = setTimeout(() => {
            Methods.CleanPrepareWeedWrapDom();
            Methods.SetWhenUserStopAction(1);
            getDataDebounceTimer = null;
        }, 300);
        
    }
}
