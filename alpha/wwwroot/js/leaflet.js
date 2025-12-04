const LeafLet = {
    Init() {
        // ================= Configuration =================
        const baseWidth = 1920;   // Width at Scale 1 (Zoom 0)
        const baseHeight = 1080;  // Height at Scale 1 (Zoom 0)
        const maxZoom = 7;        // Max zoom level (Scale 128)
        const tileSize = 512;     // Tile size
        // =================================================

        // 1. Initialize Map (Using CRS.Simple for flat pixel coordinates)
        const map = L.map('mapCanvas', {
            crs: L.CRS.Simple,
            minZoom: 0,
            maxZoom: maxZoom,
            zoomSnap: 1, // Only allow integer zoom levels
            zoomDelta: 1, // Zoom in/out by 1 level at a time
            // Sticky bounds behavior
            // 1.0 means the map stops solid at the edge (no elastic bounce).
            maxBoundsViscosity: 1.0,
            attributionControl: false,
            zoomControl: false
        });

        // Define map bounds [SouthWest, NorthEast]
        // Note: In CRS.Simple, Y-axis goes down, so we use negative height.
        const bounds = [[-baseHeight, 0], [0, baseWidth]];
        map.setMaxBounds(bounds);

        // 2. Add Main Map Layer
        const mapLayer = L.tileLayer('/img/map/{z}/{x}_{y}.webp', {
            tileSize: tileSize,
            bounds: bounds,
            noWrap: true, // Prevent map from repeating horizontally
            tms: false    // Standard Y-axis orientation
        }).addTo(map);

        // 3. Initial View Settings
        map.fitBounds(bounds); // Fit map to screen
        map.setView([-baseHeight / 2, baseWidth / 2], 0); // Center map

        // Unified handler for both move and zoom events
        function handleMapUpdate() {
            try {
                const center = map.getCenter();
                const zoom = map.getZoom();
                const bounds = map.getBounds();

                // Debug: Check if bounds is valid
                if (!bounds || typeof bounds.getWest !== 'function') {
                    console.error('Invalid bounds object:', bounds);
                    return;
                }

                // Calculate top-left corner in DOM-style coordinates
                const scale = Math.pow(2, zoom);
                const scaledWidth = baseWidth * scale;
                const scaledHeight = baseHeight * scale;

                const topLeftX = Math.round(bounds.getWest());
                const topLeftY = Math.round(-bounds.getNorth());

                console.log('=== Map View Updated ===');
                console.log('Zoom level:', zoom, '(Scale:', scale + ')');
                console.log('Full map size at this scale:', scaledWidth, 'x', scaledHeight);
                console.log('Screen top-left corner (DOM-style):', { x: topLeftX, y: topLeftY });
                console.log('Center:', center);
                console.log('Bounds:', bounds);
                console.log('========================');

                // Execute custom actions
                performCustomAction(zoom, scale, center, bounds);
            } catch (error) {
                console.error('Error in handleMapUpdate:', error);
            }
        }

        // Fires when map finishes moving (pan/drag complete)
        map.on('moveend', handleMapUpdate);

        // Fires when zoom animation finishes
        map.on('zoomend', handleMapUpdate);

        function performCustomAction(zoom, scale, center, bounds) {
            let visibleDistrictIds = [];
            // Get visible region IDs when zoom >= 3
            if (zoom >= 3) {
                visibleDistrictIds = getVisibleDistrictIds(zoom, bounds);
                console.log('Visible districtIds:', visibleDistrictIds);
            }

            Variables.MapScaleInfo.current = scale;
            clearTimeout(Variables.TimeoutInfo.districtInOut);
            Variables.TimeoutInfo.districtInOut = setTimeout(function () { Socket.UnjoinMapGroup(visibleDistrictIds); }, 100);
        }

        // Calculate visible district IDs
        function getVisibleDistrictIds(zoom, bounds) {
            const districtIds = [];

            // 1. Grid Configuration
            const mapWidth = 1920;
            const mapHeight = 1080;
            const districtW = 48; // Width of one district
            const districtH = 27; // Height of one district
            const colsPerMap = 40; // 1920 / 48 = 40
            const rowsPerMap = 40; // 1080 / 27 = 40

            // 2. Get Current Map Bounds (Leaflet Coordinates)
            // Note: In CRS.Simple with the defined bounds [[-1080, 0], [0, 1920]]:
            // - North is closer to 0 (Visual Top)
            // - South is closer to -1080 (Visual Bottom)
            // - West is 0 (Visual Left)
            // - East is 1920 (Visual Right)
            
            let north = bounds.getNorth();
            let south = bounds.getSouth();
            let west = bounds.getWest();
            let east = bounds.getEast();

            // 3. Convert to Grid Coordinates (Absolute Pixel Position from Top-Left)
            // Invert Y because Leaflet Lat is negative going down, but Grid Y implies positive distance from Top.
            let topY = -north;     // e.g., -(-100) = 100
            let bottomY = -south;  // e.g., -(-500) = 500
            let leftX = west;
            let rightX = east;

            // 4. Clamp values to ensure they stay within map dimensions
            // (Prevents errors if map is dragged slightly out of bounds)
            leftX = Math.max(0, Math.min(mapWidth, leftX));
            rightX = Math.max(0, Math.min(mapWidth, rightX));
            topY = Math.max(0, Math.min(mapHeight, topY));
            bottomY = Math.max(0, Math.min(mapHeight, bottomY));

            // 5. Calculate Row/Col Indices
            // Use Math.floor to find which grid cell the coordinate falls into.
            // For the end indices, we subtract a tiny epsilon to handle exact edge cases 
            // (e.g., if rightX is 48, it should be col 0, not start of col 1).
            let startCol = Math.floor(leftX / districtW);
            let endCol = Math.floor((rightX - 0.01) / districtW);
            
            let startRow = Math.floor(topY / districtH);
            let endRow = Math.floor((bottomY - 0.01) / districtH);

            // Safety Check: Ensure indices are within valid range (0 ~ 39)
            startCol = Math.max(0, Math.min(colsPerMap - 1, startCol));
            endCol = Math.max(0, Math.min(colsPerMap - 1, endCol));
            startRow = Math.max(0, Math.min(rowsPerMap - 1, startRow));
            endRow = Math.max(0, Math.min(rowsPerMap - 1, endRow));

            // 6. Generate ID List
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    // ID Formula: Row * TotalColumns + Column
                    const id = (r * colsPerMap) + c;
                    districtIds.push(id);
                }
            }

            return districtIds;
        }
    }
}