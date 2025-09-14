const CacheManager = {
    cacheName: 'game-maps-cache-v1',
    currentWeekId: null,
    groundImages: {},
    getMapIndex: (weekId, timeOfDay) => {
        return (weekId - 1) * 3 + timeOfDay;
    },
    getFileUrls: (mapIndex) => {
        return {
            svg: `${window.cdnPrefix}/img/maps/${mapIndex}.svg`,
            png: `${window.cdnPrefix}/img/sprites/grounds_tiny/${mapIndex}.png`
        };
    },
    async addWeekToCache(weekId) {
        try {
            const cache = await caches.open(this.cacheName);
            const urlsToCache = [];
            for (let timeOfDay = 1; timeOfDay <= 3; timeOfDay++) {
                const mapIndex = this.getMapIndex(weekId, timeOfDay);
                const urls = this.getFileUrls(mapIndex);
                urlsToCache.push(urls.svg, urls.png);

                if(this.groundImages[mapIndex] == undefined) {
                    this.groundImages[mapIndex] = new Image();
                    this.groundImages[mapIndex].src = urls.png;
                }

                const fillColorKey = 'map_' + mapIndex;
                if(Images.FillColors[fillColorKey] == undefined) {
                    const fill = await Core.LoadSvgFill(urls.svg, "oceanBase");
                    Images.FillColors[fillColorKey] = fill;
                }
            }
            await cache.addAll(urlsToCache);
        } catch (error) {
            console.error(`Week ${weekId} failed to add cache:`, error);
        }
    },
    async removeWeekFromCache(weekId) {
        try {
            const cache = await caches.open(this.cacheName);
            const urlsToRemove = [];
            for (let timeOfDay = 1; timeOfDay <= 3; timeOfDay++) {
                const mapIndex = this.getMapIndex(weekId, timeOfDay);
                const urls = this.getFileUrls(mapIndex);
                urlsToRemove.push(urls.svg, urls.png);
                if(this.groundImages[mapIndex] != undefined) {
                    this.groundImages[mapIndex] = null;
                }
            }
            for (const url of urlsToRemove) {
                await cache.delete(url);
            }
        } catch (error) {
            console.error(`Week ${weekId} failed to remove cache:`, error);
        }
    },
    async updateCache(newWeekId) {
        try {
            if (newWeekId < 1 || newWeekId > Variables.TotalWeeksInYear) { return; }
            if (this.currentWeekId === null) {
                await this.addWeekToCache(newWeekId);
                if (newWeekId < Variables.TotalWeeksInYear) {
                    await this.addWeekToCache(newWeekId + 1);
                }
                this.currentWeekId = newWeekId;
                return;
            }
            if (newWeekId !== this.currentWeekId) {
                if (this.currentWeekId < newWeekId) {
                    await this.removeWeekFromCache(this.currentWeekId);
                    if (newWeekId + 1 <= Variables.TotalWeeksInYear) {
                        await this.addWeekToCache(newWeekId + 1);
                    }
                } else {
                    if (this.currentWeekId + 1 <= Variables.TotalWeeksInYear) {
                        await this.removeWeekFromCache(this.currentWeekId + 1);
                    }
                    if (newWeekId >= 1) {
                        await this.addWeekToCache(newWeekId);
                    }
                }
                this.currentWeekId = newWeekId;
            }
        } catch (error) {
            console.error('failed to update cache:', error);
        }
    },
    async getCacheStatus() {
        try {
            const cache = await caches.open(this.cacheName);
            const keys = await cache.keys();
            const cachedUrls = keys.map(request => request.url);
            return {
                count: cachedUrls.length,
                urls: cachedUrls
            };
        } catch (error) {
            console.error('failed to get cache status:', error);
            return { count: 0, urls: [] };
        }
    },
    async clearAllCache() {
        try {
            const deleted = await caches.delete(this.cacheName);
            this.currentWeekId = null;
            return deleted;
        } catch (error) {
            console.error('failed to clear all cache:', error);
            return false;
        }
    },
    async autoUpdateCache() {
        const currentWeekId = Variables.Settings.weekId || 1;
        await this.updateCache(currentWeekId);
    }
};