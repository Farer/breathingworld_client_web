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

        // 6. Event Listeners for Map Movement/Zoom Completion
        
        // Fires when map finishes moving (pan/drag complete)
        map.on('moveend', function() {
            const center = map.getCenter();
            const zoom = map.getZoom();
            const bounds = map.getBounds();
            
            // Calculate top-left corner in DOM-style coordinates
            const scale = Math.pow(2, zoom);
            const scaledWidth = baseWidth * scale;
            const scaledHeight = baseHeight * scale;
            
            // Get top-left corner from bounds
            // bounds.getNorth() gives the top Y (closest to 0)
            // bounds.getWest() gives the left X
            const topLeftX = Math.round(bounds.getWest());
            const topLeftY = Math.round(-bounds.getNorth()); // Flip Y to DOM-style (positive down)
            
            console.log('=== Map View Updated ===');
            console.log('Zoom level:', zoom, '(Scale:', scale + ')');
            console.log('Full map size at this scale:', scaledWidth, 'x', scaledHeight);
            console.log('Screen top-left corner (DOM-style):', { x: topLeftX, y: topLeftY });
            console.log('Center:', center);
            console.log('Bounds:', bounds);
            console.log('========================');
            
            // Add your custom logic here
            performCustomAction(zoom, center, bounds);
        });
        
        // Fires when zoom animation finishes
        map.on('zoomend', function() {
            const zoom = map.getZoom();
            console.log('Zoom completed! Current zoom:', zoom);
            
            // Add your custom logic here
        });
        
        // Custom function to execute after map update
        function performCustomAction(zoom, center, bounds) {
            // Example: Get visible tile coordinates
            const visibleTiles = getVisibleTiles(zoom, bounds);
            console.log('Visible tiles:', visibleTiles);
            
            // Add your custom logic here
            // For example:
            // - Load additional data
            // - Update UI elements
            // - Save current view state
            // - Fetch tile information
        }
        
        // Helper function to calculate visible tiles
        function getVisibleTiles(zoom, bounds) {
            const tiles = [];
            const scale = Math.pow(2, zoom);
            const tileScale = tileSize / scale;
            
            const minX = Math.floor(bounds.getWest() / tileScale);
            const maxX = Math.floor(bounds.getEast() / tileScale);
            const minY = Math.floor(-bounds.getNorth() / tileScale);
            const maxY = Math.floor(-bounds.getSouth() / tileScale);
            
            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    tiles.push({
                        z: zoom,
                        x: x,
                        y: y,
                        path: `/img/map/${zoom}/${x}_${y}.webp`
                    });
                }
            }
            
            return tiles;
        }
    }
}