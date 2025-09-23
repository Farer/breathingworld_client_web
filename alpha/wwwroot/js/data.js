'use strict';
const Data = {
    MapText: '',
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
        DistrictData: [],
    },
    AnimalMoving: {
        reservedTiles: [],
    },
};