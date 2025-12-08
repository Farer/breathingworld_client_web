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
        // [신규] Iframe 생성 및 초기화 함수 (Hard Reset용)
        // -----------------------------------------------------------
        const spawnGameLayer = (scale) => {
            let container = document.getElementById('webGlDom');
            if (!container) {
                console.error('#webGlDom not found, appending to body');
            }

            // 1. 기존 Iframe이 있다면 파괴 (메모리 완전 해제)
            if (this.gameIframe) {
                this.gameIframe.remove();
                this.gameIframe = null;
            }

            // 2. 새 Iframe 생성
            const iframe = document.createElement('iframe');
            iframe.src = 'world.html'; // 분리된 world.html 로드
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.background = 'transparent'; // 투명 배경
            iframe.style.pointerEvents = 'none';     // 마우스 이벤트는 지도로 통과
            
            container.appendChild(iframe);
            this.gameIframe = iframe;

            // 3. Iframe 로딩 완료 시 초기 데이터 전송 (INIT)
            iframe.onload = () => {
                const center = map.getCenter();
                iframe.contentWindow.postMessage({
                    type: 'INIT',
                    scale: scale, // 현재 스케일 (텍스처 로딩 기준)
                    viewState: {
                        // Leaflet 좌표(CRS.Simple)를 그대로 전송
                        // Child에서 이 값을 받아 화면 좌표로 변환함
                        centerX: center.lng, // X축 (0 ~ 1920)
                        centerY: center.lat, // Y축 (-1080 ~ 0)
                        zoom: map.getZoom()
                    }
                }, '*');
            };
        };

        // -----------------------------------------------------------
        // [수정] 지도 이벤트 핸들러 (역할 분리)
        // -----------------------------------------------------------
        
        // 1. 줌 종료 시 (Zoom End) -> 스케일 변경 -> Iframe 리셋
        map.on('zoomend', () => {
            const zoom = map.getZoom();
            const scale = Math.pow(2, zoom);

            // 스케일이 바뀌었을 때만 리셋 수행
            if (this.currentScale !== scale) {
                console.log(`🔄 Scale Change (${this.currentScale} -> ${scale}): Resetting World Layer...`);
                this.currentScale = scale;
                Variables.MapScaleInfo.current = scale; // 전역 변수 동기화
                
                spawnGameLayer(scale);
            }
        });

        // 2. 지도 이동 시 (Move) -> 좌표 동기화 (Iframe 유지)
        // 'move' 이벤트를 사용해 드래그 중에도 실시간으로 따라가게 함
        map.on('move', () => {
            if (this.gameIframe && this.gameIframe.contentWindow) {
                const center = map.getCenter();
                const zoom = map.getZoom();

                // 렌더링에 필요한 좌표 정보만 전송
                // (구역 계산 로직은 Child로 이동했으므로 제거됨)
                this.gameIframe.contentWindow.postMessage({
                    type: 'SYNC_POSITION',
                    viewState: {
                        centerX: center.lng,
                        centerY: center.lat,
                        zoom: zoom
                    }
                }, '*');
            }
        });

        // 초기 실행 (앱 시작 시 1회)
        this.currentScale = Math.pow(2, map.getZoom());
        Variables.MapScaleInfo.current = this.currentScale;
        spawnGameLayer(this.currentScale);
    }
};