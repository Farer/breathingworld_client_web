const LeafLet = {
    gameIframe: null, // Iframe 요소 참조 저장
    currentScale: 1,  // 현재 스케일 추적

    Init() {
        // ================= Configuration =================
        const baseWidth = 1920;
        const baseHeight = 1080;
        const maxZoom = 7;
        const tileSize = 512;
        // =================================================

        // 1. Initialize Map
        const map = L.map('mapCanvas', {
            crs: L.CRS.Simple,
            minZoom: 0,
            maxZoom: maxZoom,
            zoomSnap: 1,
            zoomDelta: 1,
            maxBoundsViscosity: 1.0,
            attributionControl: false,
            zoomControl: false
        });

        const bounds = [[-baseHeight, 0], [0, baseWidth]];
        map.setMaxBounds(bounds);

        L.tileLayer('/img/map/{z}/{x}_{y}.webp', {
            tileSize: tileSize,
            bounds: bounds,
            noWrap: true,
            tms: false
        }).addTo(map);

        map.fitBounds(bounds);
        map.setView([-baseHeight / 2, baseWidth / 2], 0);

        // -----------------------------------------------------------
        // [헬퍼] 위치 동기화 메시지 전송 함수 (중복 제거)
        // -----------------------------------------------------------
        const sendSyncMessage = () => {
            // Iframe이 살아있고 로드된 상태일 때만 전송
            if (this.gameIframe && this.gameIframe.contentWindow) {
                const center = map.getCenter();
                const zoom = map.getZoom();

                this.gameIframe.contentWindow.postMessage({
                    type: 'SYNC_POSITION',
                    viewState: {
                        centerX: center.lng,
                        centerY: center.lat,
                        zoom: zoom
                    }
                }, '*');
            }
        };

        // -----------------------------------------------------------
        // [신규] Iframe 생성 및 초기화 함수 (Hard Reset용)
        // -----------------------------------------------------------
        const spawnGameLayer = (scale) => {
            let container = document.getElementById('webGlDom');
            if (!container) {
                console.error('#webGlDom not found, appending to body');
                // 비상시 body에 붙이되 z-index 확보
                container = document.body;
            }

            // 1. 기존 Iframe이 있다면 파괴 (메모리 완전 해제)
            if (this.gameIframe) {
                this.gameIframe.remove();
                this.gameIframe = null;
            }

            // 2. 새 Iframe 생성
            const iframe = document.createElement('iframe');
            iframe.src = 'world.html'; 
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.background = 'transparent'; 
            iframe.style.pointerEvents = 'none';     
            
            container.appendChild(iframe);
            this.gameIframe = iframe;

            // 3. Iframe 로딩 완료 시 초기 데이터 전송 (INIT)
            iframe.onload = () => {
                const center = map.getCenter();
                iframe.contentWindow.postMessage({
                    type: 'INIT',
                    scale: scale, 
                    viewState: {
                        centerX: center.lng, 
                        centerY: center.lat, 
                        zoom: map.getZoom()
                    }
                }, '*');
            };
        };

        // -----------------------------------------------------------
        // [수정] 지도 이벤트 핸들러
        // -----------------------------------------------------------
        
        // 1. 줌 종료 시 (Zoom End)
        map.on('zoomend', () => {
            const zoom = map.getZoom();
            const scale = Math.pow(2, zoom);

            // 스케일이 바뀌었으면 -> Iframe 리셋 (INIT 메시지가 위치 정보 포함)
            if (this.currentScale !== scale) {
                console.log(`🔄 Scale Change (${this.currentScale} -> ${scale}): Resetting World Layer...`);
                this.currentScale = scale;
                Variables.MapScaleInfo.current = scale;
                
                spawnGameLayer(scale);
            } 
            // 스케일 변화 없이 줌 애니메이션만 끝난 경우 (혹은 미세 조정) -> 위치 동기화
            else {
                sendSyncMessage();
            }
        });

        // 2. 지도 이동 중 (Move) -> 실시간 동기화
        map.on('move', sendSyncMessage);

        // 3. 지도 이동 종료 (Move End) -> 최종 위치 보정
        map.on('moveend', sendSyncMessage);

        // 초기 실행 (앱 시작 시 1회)
        this.currentScale = Math.pow(2, map.getZoom());
        Variables.MapScaleInfo.current = this.currentScale;
        spawnGameLayer(this.currentScale);
    }
};