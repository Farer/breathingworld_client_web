'use strict';
const Data = {
    Weed: {
        CacheExpireMillis: 60000,
        DistrictDataUpdateTime: [],
        DistrictData: [],
        DistrictIdsBucket: new Set(),
        UserPaused: false,
    },
    Tree: {
        CacheExpireMillis: 300000,
        DistrictDataUpdateTime: [],
        IdsInDistrict: [],
        DistrictData: [],
    },
    AnimalMoving: {
        timeouts: [],
        timeoutIntervals: [],
        movingTileIds: [],
        reservedTiles: [],
    },
};