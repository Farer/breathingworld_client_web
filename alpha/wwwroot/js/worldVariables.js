'use strict';

// ✅ export 키워드 추가
export const Variables = {
    ApiUrl: '',
    SocketUrl: '',
    ChatUrl: '',
    Settings: null,
    PlantsTurnId: 0,
    TotalDaysInYear: 365,
    TotalWeeksInYear: 48,
    WeeksPerMonth: 4,
    DaysInMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    MonthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun','Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    DirtFloorWidthHeight: 128,
    ActiveWeather: null,
    WeatherResizeTimeout: null,
    UserDragged: false,
    EarthWormController: null,
    Doms: new Map(), // Iframe 내부의 DOM을 담을 Map
    MapViewPort: {
        x: 0,
        y: 0
    },
    TimeoutInfo: {
        districtInOut: null,
        updateMapImageUpdateId: null,
    },
    ScrollInfo: {
        isScrolling: false,
        upAmount: 0,
        downAmount: 0,
    },
    MapInfo: {
        firstDraw: true,
        mapImage: new Image(),
        mapMinWidth: 0,
        mapMinHeight: 0,
        viewDistrictIds: [],
    },
    MapScaleInfo: {
        previous: 1,
        current: 1,
        list: [1,2,4,8,16,32,64,128],
        maxScale: 128,
        zoomPosX: 0,
        zoomPosY: 0,
        mobileTouchStartCenterPosX: 0,
        mobileTouchStartCenterPosY: 0,
        mobileTouchStartDistance: 0,
        mobileTouchScaleIsChanged: false,
    },
    MapMoveInfo: {
        currentLeft: 0,
        currentTop: 0,
        currentPosX: 0,
        currentPosY: 0,
        movedPosX: 0,
        movedPosY: 0,
        finalLeft: 0,
        finalTop: 0,
    },
    MapCanvasInfo: {
        drawMapCase: 0,
        xStartPos: 0,
        yStartPos: 0,
        xEndPosLimit: 0,
        yEndPosLimit: 0,
        bringMapWidth: 0,
        bringMapHeight: 0,
        xPosStartOfCanvas: 0,
        yPosStartOfCanvas: 0,
        widthOfCanvas: 0,
        heightOfCanvas: 0,
    },
    lifeStages: {
        rabbit: ['adult']
    }
};