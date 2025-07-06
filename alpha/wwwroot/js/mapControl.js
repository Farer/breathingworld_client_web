'use strict'
MapControll = {
    current: { scale: 1, x: 0, y: 0 },
    target: { scale: 1, x: 0, y: 0 },
    EASING_FACTOR: 0.15,
    MIN_MOVEMENT: 0.01,
    animationFrameId: null,
    ZOOM_LEVELS: [1, 2, 4, 8, 16, 32, 64, 128],
    BASE_VIEWPORT: { width: 1920, height: 1080 },
    currentZoomIndex: 0,
    baseScale: 1,
    isDragging: false,
    lastPosition: { x: 0, y: 0 },
    isPinching: false,
    initialPinchDistance: 0,
    pinchStart: { scale: 1, center: {x: 0, y: 0}, mapCenter: {x: 0, y: 0} },
    ignoreNextDragFrame: false,
    wheelTimeout: null,
    WHEEL_THROTTLE_MS: 200,
    canvas: null, ctx: null, mapImage: null,
    Prepare: () => {
        canvas = document.getElementById('map-canvas');
        ctx = canvas.getContext('2d');
        mapImage = new Image(),
        mapImage.src = 'map1.svg';
    },
    requestRender: () => { if (!animationFrameId) { animationFrameId = requestAnimationFrame(renderLoop); } },
    renderLoop: () => {
        current.x += (target.x - current.x) * EASING_FACTOR;
        current.y += (target.y - current.y) * EASING_FACTOR;
        current.scale += (target.scale - current.scale) * EASING_FACTOR;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(current.x, current.y);
        ctx.scale(current.scale, current.scale);
        ctx.drawImage(mapImage, 0, 0);
        ctx.restore();
        const dx = Math.abs(target.x - current.x);
        const dy = Math.abs(target.y - current.y);
        const ds = Math.abs(target.scale - current.scale);
        if (dx < MIN_MOVEMENT && dy < MIN_MOVEMENT && ds < MIN_MOVEMENT) {
            current = { ...target };
            animationFrameId = null;
        } else {
            animationFrameId = requestAnimationFrame(renderLoop);
        }
    },
    setupInitialView: () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        baseScale = Math.min(BASE_VIEWPORT.width / mapImage.width, BASE_VIEWPORT.height / mapImage.height);
        setZoomLevel(0);
        target.x = (canvas.width - mapImage.width * target.scale) / 2;
        target.y = (canvas.height - mapImage.height * target.scale) / 2;
        current = { ...target };
        clampTargetPosition();
    },
    addEventListeners: () => {
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);
        canvas.addEventListener('touchcancel', handleTouchEnd);
        window.addEventListener('resize', handleResize);
    },
    clampTargetPosition: () => {
        const scaledMapWidth = mapImage.width * target.scale;
        const scaledMapHeight = mapImage.height * target.scale;
        const minX = Math.min(0, canvas.width - scaledMapWidth);
        const maxX = Math.max(0, canvas.width - scaledMapWidth);
        const minY = Math.min(0, canvas.height - scaledMapHeight);
        const maxY = Math.max(0, canvas.height - scaledMapHeight);
        target.x = Math.max(minX, Math.min((scaledMapWidth > canvas.width ? 0 : maxX), target.x));
        target.y = Math.max(minY, Math.min((scaledMapHeight > canvas.height ? 0 : maxY), target.y));
    },
    setZoomLevel(index) {
        currentZoomIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index));
        target.scale = baseScale * ZOOM_LEVELS[currentZoomIndex];
    },
    handleMouseDown(e) {
        isDragging = true;
        lastPosition = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
    },
    handleMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - lastPosition.x;
        const dy = e.clientY - lastPosition.y;
        target.x += dx;
        target.y += dy;
        clampTargetPosition();
        lastPosition = { x: e.clientX, y: e.clientY };
        requestRender();
    },
    handleMouseUp: () => { isDragging = false; canvas.style.cursor = 'grab'; },
    handleMouseLeave: () => { isDragging = false; canvas.style.cursor = 'grab'; },
    handleWheel(e) {
        e.preventDefault();
        if (wheelTimeout) return;
        const direction = e.deltaY > 0 ? -1 : 1;
        if ((direction === 1 && currentZoomIndex === ZOOM_LEVELS.length - 1) || (direction === -1 && currentZoomIndex === 0)) return;
        const mouse = { x: e.clientX, y: e.clientY };
        const mapMouseX = (mouse.x - target.x) / target.scale;
        const mapMouseY = (mouse.y - target.y) / target.scale;
        setZoomLevel(currentZoomIndex + direction);
        target.x = mouse.x - mapMouseX * target.scale;
        target.y = mouse.y - mapMouseY * target.scale;
        clampTargetPosition();
        requestRender();
        wheelTimeout = setTimeout(() => { wheelTimeout = null; }, WHEEL_THROTTLE_MS);
    },
    handleResize: () => {
        const oldWidth = canvas.width;
        const oldHeight = canvas.height;
        const mapCenterX = (oldWidth / 2 - current.x) / current.scale;
        const mapCenterY = (oldHeight / 2 - current.y) / current.scale;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        target.x = canvas.width / 2 - mapCenterX * current.scale;
        target.y = canvas.height / 2 - mapCenterY * current.scale;
        clampTargetPosition();
        requestRender();
    },
    getDistance(t1, t2) { return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); },
    getCenter(t1, t2) { return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }; },
    handleTouchStart(e) {
        e.preventDefault();
        ignoreNextDragFrame = false;
        if (e.touches.length > 2) return;

        if (e.touches.length === 1) {
            isPinching = false;
            isDragging = true;
            lastPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            isDragging = false;
            isPinching = true;
            initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
            
            const center = getCenter(e.touches[0], e.touches[1]);
            pinchStart = {
                scale: target.scale,
                center: center,
                mapCenter: {
                    x: (center.x - target.x) / target.scale,
                    y: (center.y - target.y) / target.scale,
                }
            };
        }
    },
    handleTouchMove(e) {
        e.preventDefault();
        if (isDragging && e.touches.length === 1) {
            if (ignoreNextDragFrame) {
                lastPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                ignoreNextDragFrame = false;
                return;
            }
            const touch = e.touches[0];
            const dx = touch.clientX - lastPosition.x;
            const dy = touch.clientY - lastPosition.y;
            target.x += dx;
            target.y += dy;
            clampTargetPosition();
            lastPosition = { x: touch.clientX, y: touch.clientY };
            requestRender();
        } else if (isPinching && e.touches.length === 2) {
            const newDist = getDistance(e.touches[0], e.touches[1]);
            const zoomFactor = newDist / initialPinchDistance;
            
            target.scale = pinchStart.scale * zoomFactor;

            const minScale = baseScale * ZOOM_LEVELS[0] * 0.8;
            const maxScale = baseScale * ZOOM_LEVELS[ZOOM_LEVELS.length - 1] * 1.2;
            target.scale = Math.max(minScale, Math.min(maxScale, target.scale));
            
            const center = getCenter(e.touches[0], e.touches[1]);
            target.x = center.x - pinchStart.mapCenter.x * target.scale;
            target.y = center.y - pinchStart.mapCenter.y * target.scale;
            
            clampTargetPosition();
            requestRender();
        }
    },
    handleTouchEnd(e) {
        e.preventDefault();

        if (isPinching) {
            const finalIndex = snapToSingleLevel();
            setZoomLevel(finalIndex);
            
            target.x = pinchStart.center.x - pinchStart.mapCenter.x * target.scale;
            target.y = pinchStart.center.y - pinchStart.mapCenter.y * target.scale;

            clampTargetPosition();
            requestRender();

            ignoreNextDragFrame = true;
        }
        
        isPinching = false;
        isDragging = false;
        
        if (e.touches.length === 1) {
            isDragging = true;
            lastPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    },
    snapToSingleLevel: () => {
        const finalEffectiveScale = target.scale / baseScale;
        const pinchStartIndex = ZOOM_LEVELS.indexOf(pinchStart.scale / baseScale);
        
        let startIndex = pinchStartIndex;
        if (startIndex === -1) {
             let minDiff = Infinity;
             ZOOM_LEVELS.forEach((level, index) => {
                const diff = Math.abs((pinchStart.scale / baseScale) - level);
                if (diff < minDiff) {
                    minDiff = diff;
                    startIndex = index;
                }
            });
        }
        
        const startLevelScale = ZOOM_LEVELS[startIndex];
        let finalIndex = startIndex;

        if (finalEffectiveScale > startLevelScale) {
            if (startIndex < ZOOM_LEVELS.length - 1) {
                const nextLevelScale = ZOOM_LEVELS[startIndex + 1];
                const threshold = (startLevelScale + nextLevelScale) / 2;
                if (finalEffectiveScale > threshold) {
                    finalIndex = startIndex + 1;
                }
            }
        } else if (finalEffectiveScale < startLevelScale) {
            if (startIndex > 0) {
                const prevLevelScale = ZOOM_LEVELS[startIndex - 1];
                const threshold = (startLevelScale + prevLevelScale) / 2;
                if (finalEffectiveScale < threshold) {
                    finalIndex = startIndex - 1;
                }
            }
        }
        return finalIndex;
    }
};