'use strict';
const Sprites = {
    Rabbit: {
        width: 31232,
        height: 2560,
        frameWidth: 512,
        frameHeight: 512,
        actions: ['idle','walk','eat','jump','sleep'],
        frameCounts: [10, 24, 21, 61, 61],
        frameDelay: [130, 65, 60, 50, 70],
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
        frameDelay: [60, 60, 60, 50, 50],
        etcImageWidth: 1536,
        etcImageHeight: 512,
    },
};