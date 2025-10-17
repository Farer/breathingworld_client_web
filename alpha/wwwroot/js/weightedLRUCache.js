// weightedLRUCache.js
'use strict';

export class WeightedLRUCache {
    constructor(maxSize = 4000) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.weights = new Map();
    }

    has(key) {
        return this.cache.has(key);
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        
        // 가중치 증가
        const currentWeight = this.weights.get(key) || 0;
        this.weights.set(key, currentWeight + 1);
        
        // 최신으로 이동
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        
        this.cache.set(key, value);
        this.weights.set(key, 1);
        
        if (this.cache.size > this.maxSize) {
            // 가중치가 가장 낮은 항목 찾기
            let minWeight = Infinity;
            let minKey = null;
            
            for (const [k, v] of this.cache.entries()) {
                const weight = this.weights.get(k) || 0;
                if (weight < minWeight) {
                    minWeight = weight;
                    minKey = k;
                }
            }
            
            if (minKey) {
                const oldTexture = this.cache.get(minKey);
                try {
                    if (oldTexture && oldTexture.destroy) {
                        oldTexture.destroy(true);
                    }
                } catch (e) {
                    console.warn('Texture cleanup failed:', e);
                }
                
                this.cache.delete(minKey);
                this.weights.delete(minKey);
            }
        }
    }

    clear() {
        for (const [key, texture] of this.cache.entries()) {
            try {
                if (texture && texture.destroy) {
                    texture.destroy(true);
                }
            } catch (e) {}
        }
        this.cache.clear();
        this.weights.clear();
    }

    get size() {
        return this.cache.size;
    }

    // 주기적으로 가중치 감소
    decayWeights(factor = 0.9) {
        for (const [key, weight] of this.weights.entries()) {
            this.weights.set(key, Math.floor(weight * factor));
        }
    }
}