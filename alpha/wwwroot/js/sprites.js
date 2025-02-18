'use strict';
const Sprites = {
    Rabbit: {
        width: 31232,
        height: 2560,
        frameWidth: 512,
        frameHeight: 512,
        actions: ['idle','walk','eat','jump','sleep'],
        frameCounts: [10, 24, 21, 61, 61],
        frameDelay: [250, 130, 120, 100, 140],
        etcImageWidth: 1536,
        etcImageHeight: 512,
    },
    Wolf: {
        width: 30976,
        height: 3072,
        frameWidth: 512,
        frameHeight: 512,
        actions: ['idle','walk','eat','jump','sleep','howl'],
        frameCounts: [60, 41, 20, 51, 60, 60],
        frameDelay: [120, 120, 150, 100, 100, 100],
        etcImageWidth: 1536,
        etcImageHeight: 512,
    },
};