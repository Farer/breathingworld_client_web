const MapCache = {
    cacheName: 'map-svg-cache',
    svgText: null,
    
    async getSvgText(url) {
        if (this.svgText !== null) { return this.svgText; }
        
        try {
            const cache = await caches.open(this.cacheName);
            const cachedResponse = await cache.match(url);
            
            if (cachedResponse) {
                this.svgText = await cachedResponse.text();
                return this.svgText;
            }
        } catch (error) {
            console.warn('Cache API error:', error);
        }
        
        const response = await fetch(url);
        const svgText = await response.text();
        
        try {
            const cache = await caches.open(this.cacheName);
            await cache.put(url, new Response(svgText, {
                headers: { 'Content-Type': 'image/svg+xml' }
            }));
        } catch (error) {
            console.warn('failed to save. Cache API:', error);
        }
        this.svgText = svgText;
        return svgText;
    }
};