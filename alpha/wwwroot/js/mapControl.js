'use strict'
const MapControl = {
    current: { scale: 1, x: 0, y: 0 },
    target: { scale: 1, x: 0, y: 0 },
    EASING_FACTOR: 0.15,
    MIN_MOVEMENT: 0.01,
    animationFrameId: null,
    ZOOM_LEVELS: [],
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
        MapControl.ZOOM_LEVELS = Variables.MapScaleInfo.list;
        MapControl.canvas = document.getElementById('mapCanvas');
        MapControl.ctx = MapControl.canvas.getContext('2d');
        MapControl.mapImage = new Image(),
        MapControl.mapImage.src = Images.Data['map_'+Variables.Settings.seasonId].src;
        MapControl.mapImage.onload = () => {
            MapControl.setupInitialView();
            MapControl.addEventListeners();
            MapControl.requestRender();
        };
    },
    requestRender: () => {
        if (!MapControl.animationFrameId) { MapControl.animationFrameId = requestAnimationFrame(MapControl.renderLoop); }
    },
    renderLoop: () => {
        MapControl.current.x += (MapControl.target.x - MapControl.current.x) * MapControl.EASING_FACTOR;
        MapControl.current.y += (MapControl.target.y - MapControl.current.y) * MapControl.EASING_FACTOR;
        MapControl.current.scale += (MapControl.target.scale - MapControl.current.scale) * MapControl.EASING_FACTOR;
        MapControl.ctx.clearRect(0, 0, MapControl.canvas.width, MapControl.canvas.height);
        MapControl.ctx.save();
        MapControl.ctx.translate(MapControl.current.x, MapControl.current.y);
        MapControl.ctx.scale(MapControl.current.scale, MapControl.current.scale);
        MapControl.ctx.drawImage(MapControl.mapImage, 0, 0);
        MapControl.ctx.restore();
        const dx = Math.abs(MapControl.target.x - MapControl.current.x);
        const dy = Math.abs(MapControl.target.y - MapControl.current.y);
        const ds = Math.abs(MapControl.target.scale - MapControl.current.scale);
        if (dx < MapControl.MIN_MOVEMENT && dy < MapControl.MIN_MOVEMENT && ds < MapControl.MIN_MOVEMENT) {
            MapControl.current = { ...MapControl.target };
            MapControl.animationFrameId = null;
        } else {
            MapControl.animationFrameId = requestAnimationFrame(MapControl.renderLoop);
        }
    },
    setupInitialView: () => {
        MapControl.canvas.width = window.innerWidth;
        MapControl.canvas.height = window.innerHeight;
        MapControl.baseScale = Math.min(MapControl.BASE_VIEWPORT.width / MapControl.mapImage.width, MapControl.BASE_VIEWPORT.height / MapControl.mapImage.height);
        MapControl.setZoomLevel(0);
        MapControl.target.x = (MapControl.canvas.width - MapControl.mapImage.width * MapControl.target.scale) / 2;
        MapControl.target.y = (MapControl.canvas.height - MapControl.mapImage.height * MapControl.target.scale) / 2;
        MapControl.current = { ...MapControl.target };
        MapControl.clampTargetPosition();
    },
    addEventListeners: () => {
        MapControl.canvas.addEventListener('mousedown', MapControl.handleMouseDown);
        MapControl.canvas.addEventListener('mousemove', MapControl.handleMouseMove);
        MapControl.canvas.addEventListener('mouseup', MapControl.handleMouseUp);
        MapControl.canvas.addEventListener('mouseleave', MapControl.handleMouseLeave);
        MapControl.canvas.addEventListener('wheel', MapControl.handleWheel, { passive: false });
        MapControl.canvas.addEventListener('touchstart', MapControl.handleTouchStart, { passive: false });
        MapControl.canvas.addEventListener('touchmove', MapControl.handleTouchMove, { passive: false });
        MapControl.canvas.addEventListener('touchend', MapControl.handleTouchEnd);
        MapControl.canvas.addEventListener('touchcancel', MapControl.handleTouchEnd);
        window.addEventListener('resize', MapControl.handleResize);
    },
    clampTargetPosition: () => {
        const scaledMapWidth = MapControl.mapImage.width * MapControl.target.scale;
        const scaledMapHeight = MapControl.mapImage.height * MapControl.target.scale;
        const minX = Math.min(0, MapControl.canvas.width - scaledMapWidth);
        const maxX = Math.max(0, MapControl.canvas.width - scaledMapWidth);
        const minY = Math.min(0, MapControl.canvas.height - scaledMapHeight);
        const maxY = Math.max(0, MapControl.canvas.height - scaledMapHeight);
        MapControl.target.x = Math.max(minX, Math.min((scaledMapWidth > MapControl.canvas.width ? 0 : maxX), MapControl.target.x));
        MapControl.target.y = Math.max(minY, Math.min((scaledMapHeight > MapControl.canvas.height ? 0 : maxY), MapControl.target.y));
    },
    setZoomLevel(index) {
        MapControl.currentZoomIndex = Math.max(0, Math.min(MapControl.ZOOM_LEVELS.length - 1, index));
        MapControl.target.scale = MapControl.baseScale * MapControl.ZOOM_LEVELS[MapControl.currentZoomIndex];
    },
    handleMouseDown(e) {
        MapControl.isDragging = true;
        MapControl.lastPosition = { x: e.clientX, y: e.clientY };
        MapControl.canvas.style.cursor = 'grabbing';
    },
    handleMouseMove(e) {
        if (!MapControl.isDragging) return;
        const dx = e.clientX - MapControl.lastPosition.x;
        const dy = e.clientY - MapControl.lastPosition.y;
        MapControl.target.x += dx;
        MapControl.target.y += dy;
        MapControl.clampTargetPosition();
        MapControl.lastPosition = { x: e.clientX, y: e.clientY };
        MapControl.requestRender();
    },
    handleMouseUp: () => {
        MapControl.isDragging = false;
        MapControl.canvas.style.cursor = 'grab';
    },
    handleMouseLeave: () => {
        MapControl.isDragging = false;
        MapControl.canvas.style.cursor = 'grab';
    },
    handleWheel(e) {
        e.preventDefault();
        if (MapControl.wheelTimeout) return;
        const direction = e.deltaY > 0 ? -1 : 1;
        if ((direction === 1 && MapControl.currentZoomIndex === MapControl.ZOOM_LEVELS.length - 1) || (direction === -1 && MapControl.currentZoomIndex === 0)) return;
        const mouse = { x: e.clientX, y: e.clientY };
        const mapMouseX = (mouse.x - MapControl.target.x) / MapControl.target.scale;
        const mapMouseY = (mouse.y - MapControl.target.y) / MapControl.target.scale;
        MapControl.setZoomLevel(MapControl.currentZoomIndex + direction);
        MapControl.target.x = mouse.x - mapMouseX * MapControl.target.scale;
        MapControl.target.y = mouse.y - mapMouseY * MapControl.target.scale;
        MapControl.clampTargetPosition();
        MapControl.requestRender();
        MapControl.wheelTimeout = setTimeout(() => { MapControl.wheelTimeout = null; }, MapControl.WHEEL_THROTTLE_MS);
    },
    handleResize: () => {
        const oldWidth = MapControl.canvas.width;
        const oldHeight = MapControl.canvas.height;
        const mapCenterX = (oldWidth / 2 - MapControl.current.x) / MapControl.current.scale;
        const mapCenterY = (oldHeight / 2 - MapControl.current.y) / MapControl.current.scale;
        MapControl.canvas.width = window.innerWidth;
        MapControl.canvas.height = window.innerHeight;
        MapControl.target.x = MapControl.canvas.width / 2 - mapCenterX * MapControl.current.scale;
        MapControl.target.y = MapControl.canvas.height / 2 - mapCenterY * MapControl.current.scale;
        MapControl.clampTargetPosition();
        MapControl.requestRender();
    },
    getDistance(t1, t2) { return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); },
    getCenter(t1, t2) { return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }; },
    handleTouchStart(e) {
        e.preventDefault();
        MapControl.ignoreNextDragFrame = false;
        if (e.touches.length > 2) return;

        if (e.touches.length === 1) {
            MapControl.isPinching = false;
            MapControl.isDragging = true;
            MapControl.lastPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            MapControl.isDragging = false;
            MapControl.isPinching = true;
            MapControl.initialPinchDistance = MapControl.getDistance(e.touches[0], e.touches[1]);
            
            const center = MapControl.getCenter(e.touches[0], e.touches[1]);
            MapControl.pinchStart = {
                scale: MapControl.target.scale,
                center: center,
                mapCenter: {
                    x: (center.x - MapControl.target.x) / MapControl.target.scale,
                    y: (center.y - MapControl.target.y) / MapControl.target.scale,
                }
            };
        }
    },
    handleTouchMove(e) {
        e.preventDefault();
        if (MapControl.isDragging && e.touches.length === 1) {
            if (MapControl.ignoreNextDragFrame) {
                MapControl.lastPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                MapControl.ignoreNextDragFrame = false;
                return;
            }
            const touch = e.touches[0];
            const dx = touch.clientX - MapControl.lastPosition.x;
            const dy = touch.clientY - MapControl.lastPosition.y;
            MapControl.target.x += dx;
            MapControl.target.y += dy;
            MapControl.clampTargetPosition();
            MapControl.lastPosition = { x: touch.clientX, y: touch.clientY };
            MapControl.requestRender();
        } else if (MapControl.isPinching && e.touches.length === 2) {
            const newDist = MapControl.getDistance(e.touches[0], e.touches[1]);
            const zoomFactor = newDist / MapControl.initialPinchDistance;
            
            MapControl.target.scale = MapControl.pinchStart.scale * zoomFactor;

            const minScale = MapControl.baseScale * MapControl.ZOOM_LEVELS[0] * 0.8;
            const maxScale = MapControl.baseScale * MapControl.ZOOM_LEVELS[MapControl.ZOOM_LEVELS.length - 1] * 1.2;
            MapControl.target.scale = Math.max(minScale, Math.min(maxScale, MapControl.target.scale));
            
            const center = MapControl.getCenter(e.touches[0], e.touches[1]);
            MapControl.target.x = center.x - MapControl.pinchStart.mapCenter.x * MapControl.target.scale;
            MapControl.target.y = center.y - MapControl.pinchStart.mapCenter.y * MapControl.target.scale;
            
            MapControl.clampTargetPosition();
            MapControl.requestRender();
        }
    },
    handleTouchEnd(e) {
        e.preventDefault();

        if (MapControl.isPinching) {
            const finalIndex = MapControl.snapToSingleLevel();
            MapControl.setZoomLevel(finalIndex);
            
            MapControl.target.x = MapControl.pinchStart.center.x - MapControl.pinchStart.mapCenter.x * MapControl.target.scale;
            MapControl.target.y = MapControl.pinchStart.center.y - MapControl.pinchStart.mapCenter.y * MapControl.target.scale;

            MapControl.clampTargetPosition();
            MapControl.requestRender();

            MapControl.ignoreNextDragFrame = true;
        }
        
        MapControl.isPinching = false;
        MapControl.isDragging = false;
        
        if (e.touches.length === 1) {
            MapControl.isDragging = true;
            MapControl.lastPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    },
    snapToSingleLevel: () => {
        const finalEffectiveScale = MapControl.target.scale / MapControl.baseScale;
        let pinchStartIndex = MapControl.ZOOM_LEVELS.indexOf(MapControl.pinchStart.scale / MapControl.baseScale);
        
        let startIndex = pinchStartIndex;
        if (startIndex === -1) {
             let minDiff = Infinity;
             MapControl.ZOOM_LEVELS.forEach((level, index) => {
                const diff = Math.abs((MapControl.pinchStart.scale / MapControl.baseScale) - level);
                if (diff < minDiff) {
                    minDiff = diff;
                    startIndex = index;
                }
            });
        }
        
        const startLevelScale = MapControl.ZOOM_LEVELS[startIndex];
        let finalIndex = startIndex;

        if (finalEffectiveScale > startLevelScale) {
            if (startIndex < MapControl.ZOOM_LEVELS.length - 1) {
                const nextLevelScale = MapControl.ZOOM_LEVELS[startIndex + 1];
                const threshold = (startLevelScale + nextLevelScale) / 2;
                if (finalEffectiveScale > threshold) {
                    finalIndex = startIndex + 1;
                }
            }
        } else if (finalEffectiveScale < startLevelScale) {
            if (startIndex > 0) {
                const prevLevelScale = MapControl.ZOOM_LEVELS[startIndex - 1];
                const threshold = (startLevelScale + prevLevelScale) / 2;
                if (finalEffectiveScale < threshold) {
                    finalIndex = startIndex - 1;
                }
            }
        }
        return finalIndex;
    }
};