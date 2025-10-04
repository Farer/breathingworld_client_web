'use strict';
const Data = {
    DistrictIdsBucket: new Set(),
    UserPaused: false,
    EarthWorm: {
        CacheExpireMillis: 60000,
        DistrictDataUpdateTime: [],
        DistrictData: new Map(),
    },
    Weed: {
        CacheExpireMillis: 60000,
        DistrictDataUpdateTime: [],
        DistrictData: [],
    },
    Tree: {
        CacheExpireMillis: 60000,
        DistrictDataUpdateTime: [],
        IdsInDistrict: [],
        DistrictData: [],
    },
    Feces: {
        DistrictData: [],
    },
    AnimalMoving: {
        reservedTiles: [],
    },
};