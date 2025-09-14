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
                    console.log('Images.FillColors 에 추가 '+fill);
                }
            }
            console.log(`캐시에 추가 중: Week ${weekId}`, urlsToCache);
            await cache.addAll(urlsToCache);
            console.log(`캐시 추가 완료: Week ${weekId} (6개 파일)`);
        } catch (error) {
            console.error(`Week ${weekId} 캐시 추가 실패:`, error);
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
            console.log(`캐시에서 제거 중: Week ${weekId}`, urlsToRemove);
            for (const url of urlsToRemove) {
                await cache.delete(url);
            }
            console.log(`캐시 제거 완료: Week ${weekId} (6개 파일)`);
        } catch (error) {
            console.error(`Week ${weekId} 캐시 제거 실패:`, error);
        }
    },
    async updateCache(newWeekId) {
        try {
            if (newWeekId < 1 || newWeekId > Variables.TotalWeeksInYear) {
                console.warn(`유효하지 않은 weekId: ${newWeekId}`);
                return;
            }
            if (this.currentWeekId === null) {
                console.log('초기 캐시 설정 시작...');
                await this.addWeekToCache(newWeekId);
                if (newWeekId < Variables.TotalWeeksInYear) {
                    await this.addWeekToCache(newWeekId + 1);
                }
                this.currentWeekId = newWeekId;
                console.log(`초기 캐시 설정 완료: Week ${newWeekId}, ${newWeekId + 1}`);
                return;
            }
            if (newWeekId !== this.currentWeekId) {
                console.log(`WeekId 변경: ${this.currentWeekId} → ${newWeekId}`);
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
                console.log(`캐시 업데이트 완료: 현재 Week ${newWeekId}`);
            }
        } catch (error) {
            console.error('캐시 업데이트 실패:', error);
        }
    },
    async getCacheStatus() {
        try {
            const cache = await caches.open(this.cacheName);
            const keys = await cache.keys();
            const cachedUrls = keys.map(request => request.url);
            console.log('현재 캐시된 파일들:', cachedUrls);
            console.log(`총 캐시된 파일 수: ${cachedUrls.length}`);
            return {
                count: cachedUrls.length,
                urls: cachedUrls
            };
        } catch (error) {
            console.error('캐시 상태 확인 실패:', error);
            return { count: 0, urls: [] };
        }
    },
    async clearAllCache() {
        try {
            const deleted = await caches.delete(this.cacheName);
            console.log(`전체 캐시 삭제: ${deleted ? '성공' : '실패'}`);
            this.currentWeekId = null;
            return deleted;
        } catch (error) {
            console.error('캐시 삭제 실패:', error);
            return false;
        }
    },
    async autoUpdateCache() {
        console.log('autoUpdateCache 호출');
        const currentWeekId = Variables.Settings.weekId || 1;
        await this.updateCache(currentWeekId);
    }
};