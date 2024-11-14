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
        CacheExpireMillis: 60000,
        DistrictDataUpdateTime: [],
        IdsInDistrict: [],
        DistrictData: [],
    },
    Feces: {
        CacheExpireMillis: 60000,
        DistrictDataUpdateTime: [],
        DistrictData: [],
    },
    AnimalMoving: {
        timeouts: [],
        timeoutIntervals: [],
        movingTileIds: [],
        reservedTiles: [],
    },
};