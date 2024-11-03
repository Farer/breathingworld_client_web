'use strict';
const Sprites = {
    Rabbit: {
        width: 31232,
        height: 2560,
        frameWidth: 512,
        frameHeight: 512,
        actions: ['idle','walk','eat','jump','sleep'],
        frameCounts: [10, 24, 21, 61, 61],
        frameDelay: [220, 125, 150, 50, 100],
        etcImageWidth: 1536,
        etcImageHeight: 512,
    },
    Wolf: {
        width: 30976,
        height: 3072,
        frameWidth: 512,
        frameHeight: 512,
        actions: ['idle','walk','eat','jump','sleep','howl'],
        frameCounts: [61, 41, 21, 51, 60, 60],
        frameDelay: [50, 50, 50, 50, 50],
        etcImageWidth: 1536,
        etcImageHeight: 512,
    },
};