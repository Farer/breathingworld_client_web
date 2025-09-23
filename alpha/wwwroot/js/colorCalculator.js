class ColorCalculator {
    #ALL_COLORS = [
        { ocean: "#c6ddfd", land: "#d0d6e2" }, { ocean: "#b4dbff", land: "#b2bfcc" }, { ocean: "#4ec7ff", land: "#a3b2b9" },
        { ocean: "#c6ddfd", land: "#d0d6e1" }, { ocean: "#b4dbff", land: "#b2bfcc" }, { ocean: "#4ec7ff", land: "#9baab1" },
        { ocean: "#c6ddfd", land: "#d0d6e1" }, { ocean: "#b4dbff", land: "#b2bfcc" }, { ocean: "#4ec7ff", land: "#8c9ca4" },
        { ocean: "#c6ddfd", land: "#dfe2cf" }, { ocean: "#b4dbff", land: "#ccccb2" }, { ocean: "#4ec7ff", land: "#948e6e" },
        { ocean: "#cbe2fd", land: "#e3e2cf" }, { ocean: "#b9e1ff", land: "#ccc6b2" }, { ocean: "#53d1ff", land: "#776a56" },
        { ocean: "#cbe2fd", land: "#d2cab1" }, { ocean: "#b9e1ff", land: "#b9ab96" }, { ocean: "#53d1ff", land: "#5c4c41" },
        { ocean: "#cbe2fd", land: "#c7ba9c" }, { ocean: "#b9e1ff", land: "#ac9983" }, { ocean: "#53d1ff", land: "#493b34" },
        { ocean: "#cbe2fd", land: "#c5b58e" }, { ocean: "#b9e1ff", land: "#a6927a" }, { ocean: "#53d1ff", land: "#43342b" },
        { ocean: "#cfe5fc", land: "#cbbf92" }, { ocean: "#c5e7fe", land: "#aa9a80" }, { ocean: "#5dd9ff", land: "#4b3b2d" },
        { ocean: "#cfe5fc", land: "#d3d396" }, { ocean: "#c5e7fe", land: "#afa887" }, { ocean: "#5dd9ff", land: "#56482d" },
        { ocean: "#cfe5fc", land: "#cfda9b" }, { ocean: "#c5e7fe", land: "#b4b48d" }, { ocean: "#5dd9ff", land: "#61592e" },
        { ocean: "#cfe5fc", land: "#d2e7a6" }, { ocean: "#c5e7fe", land: "#c0c893" }, { ocean: "#5dd9ff", land: "#7c7b2c" },
        { ocean: "#d0e8fb", land: "#cceea8" }, { ocean: "#d0edfd", land: "#bdd291" }, { ocean: "#68e3ff", land: "#7b8a26" },
        { ocean: "#d0e8fb", land: "#c0e69a" }, { ocean: "#d0edfd", land: "#b1c587" }, { ocean: "#68e3ff", land: "#687426" },
        { ocean: "#d0e8fb", land: "#b5e287" }, { ocean: "#d0edfd", land: "#a7bf77" }, { ocean: "#68e3ff", land: "#586420" },
        { ocean: "#d0e8fb", land: "#a9de75" }, { ocean: "#d0edfd", land: "#9db968" }, { ocean: "#68e3ff", land: "#49531b" },
        { ocean: "#d1eafa", land: "#9cdb63" }, { ocean: "#d5f1fd", land: "#93b358" }, { ocean: "#6debff", land: "#3b4415" },
        { ocean: "#d1eafa", land: "#8fd851" }, { ocean: "#d5f1fd", land: "#87ab4c" }, { ocean: "#6debff", land: "#323b12" },
        { ocean: "#d1eafa", land: "#80d63e" }, { ocean: "#d5f1fd", land: "#799e44" }, { ocean: "#6debff", land: "#313b11" },
        { ocean: "#d1eafa", land: "#73d430" }, { ocean: "#d5f1fd", land: "#6f943e" }, { ocean: "#6debff", land: "#313c11" },
        { ocean: "#ceecfd", land: "#91e061" }, { ocean: "#c3efff", land: "#8cb955" }, { ocean: "#5defff", land: "#394814" },
        { ocean: "#ceecfd", land: "#83df52" }, { ocean: "#c3efff", land: "#80b648" }, { ocean: "#5defff", land: "#2e3d10" },
        { ocean: "#ceecfd", land: "#71de42" }, { ocean: "#c3efff", land: "#73ad41" }, { ocean: "#5defff", land: "#2c3d0f" },
        { ocean: "#ceecfd", land: "#5fdd35" }, { ocean: "#c3efff", land: "#67a33c" }, { ocean: "#5defff", land: "#2a3e0f" },
        { ocean: "#cbe9fd", land: "#61d93f" }, { ocean: "#b9eaff", land: "#68a342" }, { ocean: "#53e8ff", land: "#293c10" },
        { ocean: "#cbe9fd", land: "#61d745" }, { ocean: "#b9eaff", land: "#68a346" }, { ocean: "#53e8ff", land: "#273b11" },
        { ocean: "#cbe9fd", land: "#6ed75d" }, { ocean: "#b9eaff", land: "#6fad54" }, { ocean: "#53e8ff", land: "#263b13" },
        { ocean: "#cbe9fd", land: "#62cb3c" }, { ocean: "#b9eaff", land: "#658c47" }, { ocean: "#53e8ff", land: "#2a3914" },
        { ocean: "#bcdffc", land: "#81d056" }, { ocean: "#aae1ff", land: "#7b9f53" }, { ocean: "#44dcff", land: "#2d3815" },
        { ocean: "#bcdffc", land: "#99d56f" }, { ocean: "#aae1ff", land: "#8eac65" }, { ocean: "#44dcff", land: "#3a451a" },
        { ocean: "#bcdffc", land: "#afdc88" }, { ocean: "#aae1ff", land: "#a1b77b" }, { ocean: "#44dcff", land: "#505c23" },
        { ocean: "#bcdffc", land: "#c3e29f" }, { ocean: "#aae1ff", land: "#b1c18e" }, { ocean: "#44dcff", land: "#67702c" },
        { ocean: "#b2d4fc", land: "#d4edb2" }, { ocean: "#a0d6ff", land: "#c3d19b" }, { ocean: "#3acaff", land: "#858c2d" },
        { ocean: "#b2d4fc", land: "#e0f4be" }, { ocean: "#a0d6ff", land: "#d1dca2" }, { ocean: "#3acaff", land: "#a8ab2a" },
        { ocean: "#b2d4fc", land: "#f0f5bd" }, { ocean: "#a0d6ff", land: "#ded9a0" }, { ocean: "#3acaff", land: "#ac8b27" },
        { ocean: "#b2d4fc", land: "#f2f0b1" }, { ocean: "#a0d6ff", land: "#d8cb97" }, { ocean: "#3acaff", land: "#986e25" },
        { ocean: "#a5cafa", land: "#ede39f" }, { ocean: "#92cbfd", land: "#d1bb89" }, { ocean: "#2abfff", land: "#845723" },
        { ocean: "#a5cafa", land: "#ebd58c" }, { ocean: "#92cbfd", land: "#ccab78" }, { ocean: "#2abfff", land: "#74441d" },
        { ocean: "#a5cafa", land: "#edc873" }, { ocean: "#92cbfd", land: "#cd9a60" }, { ocean: "#2abfff", land: "#673214" },
        { ocean: "#a5cafa", land: "#ebc065" }, { ocean: "#92cbfd", land: "#c99054" }, { ocean: "#2abfff", land: "#582a12" },
        { ocean: "#adcefc", land: "#e8b856" }, { ocean: "#9bceff", land: "#c48648" }, { ocean: "#35bfff", land: "#4a230f" },
        { ocean: "#adcefc", land: "#e5af48" }, { ocean: "#9bceff", land: "#bc7c3e" }, { ocean: "#35bfff", land: "#3f1d0d" },
        { ocean: "#adcefc", land: "#e2a53b" }, { ocean: "#9bceff", land: "#ae713b" }, { ocean: "#35bfff", land: "#3f1d0e" },
        { ocean: "#adcefc", land: "#d5a43e" }, { ocean: "#9bceff", land: "#9c7044" }, { ocean: "#35bfff", land: "#3b2012" },
        { ocean: "#bcd5fc", land: "#b6a37b" }, { ocean: "#aad3ff", land: "#997f66" }, { ocean: "#44bdff", land: "#2e241f" },
        { ocean: "#bcd5fc", land: "#cfc6b0" }, { ocean: "#aad3ff", land: "#b8a794" }, { ocean: "#44bdff", land: "#574a42" },
        { ocean: "#bcd5fc", land: "#e2e0d0" }, { ocean: "#aad3ff", land: "#ccc5b2" }, { ocean: "#44bdff", land: "#827463" },
        { ocean: "#bcd5fc", land: "#e2e2cf" }, { ocean: "#aad3ff", land: "#ccc7b2" }, { ocean: "#44bdff", land: "#aa9f8b" },
    ];
    
    #MIN_DAYLIGHT_HOURS = 8.0;
    #MAX_DAYLIGHT_HOURS = 16.0;
    #DAY_CENTER_HOUR = 12.0;
    #MORNING_DAYLIGHT_RATIO = 0.25;
    #WINTER_SOLSTICE_DAY = 355;
    #scheduleCache = new Map();

    #getColorsForDay(dayId) {
        const annualWeekIndex = Methods.GetWeekIdByDayId(dayId) - 1;
        const startIndex = annualWeekIndex * 3;
        
        return {
            morning: this.#ALL_COLORS[startIndex],
            day: this.#ALL_COLORS[startIndex + 1],
            night: this.#ALL_COLORS[startIndex + 2]
        };
    }

    #getScheduleForDay(dayId) {
        if (this.#scheduleCache.has(dayId)) return this.#scheduleCache.get(dayId);
        if (dayId < 1 || dayId > Variables.TotalDaysInYear) throw new Error(`dayId muse bt between 1 and ${Variables.TotalDaysInYear}.`);
        const avg = (this.#MAX_DAYLIGHT_HOURS + this.#MIN_DAYLIGHT_HOURS) / 2.0;
        const amp = (this.#MAX_DAYLIGHT_HOURS - this.#MIN_DAYLIGHT_HOURS) / 2.0;
        let daysSince = dayId >= this.#WINTER_SOLSTICE_DAY ? dayId - this.#WINTER_SOLSTICE_DAY : dayId + (Variables.TotalDaysInYear - this.#WINTER_SOLSTICE_DAY);
        const angle = 2.0 * Math.PI * daysSince / Variables.TotalDaysInYear;
        const totalDaylight = avg - amp * Math.cos(angle);
        const sunrise = this.#DAY_CENTER_HOUR - (totalDaylight / 2.0);
        const sunset = this.#DAY_CENTER_HOUR + (totalDaylight / 2.0);
        const morningDuration = totalDaylight * this.#MORNING_DAYLIGHT_RATIO;
        let morningStartHour = Math.max(0, Math.min(23, Math.round(sunrise)));
        let dayStartHour = Math.max(0, Math.min(23, Math.round(sunrise + morningDuration)));
        let nightStartHour = Math.max(0, Math.min(23, Math.round(sunset)));
        const schedule = { morningStartHour, dayStartHour, nightStartHour };
        this.#scheduleCache.set(dayId, schedule);
        return schedule;
    }

    #hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    }

    #rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, '0');
    }

    #interpolateColor(color1, color2, ratio) {
        const c1 = this.#hexToRgb(color1);
        const c2 = this.#hexToRgb(color2);
        if (!c1 || !c2) return color1;
        const r = Math.round(c1.r * (1 - ratio) + c2.r * ratio);
        const g = Math.round(c1.g * (1 - ratio) + c2.g * ratio);
        const b = Math.round(c1.b * (1 - ratio) + c2.b * ratio);
        return this.#rgbToHex(r, g, b);
    }
    
    #interpolateColorPair(pair1, pair2, ratio) {
        return {
            ocean: this.#interpolateColor(pair1.ocean, pair2.ocean, ratio),
            land: this.#interpolateColor(pair1.land, pair2.land, ratio)
        };
    }

    getColor(dayId, hourId) {
        const currentSchedule = this.#getScheduleForDay(dayId);
        const prevDayId = dayId > 1 ? dayId - 1 : 365;
        const nextDayId = dayId < 365 ? dayId + 1 : 1;
        const prevSchedule = this.#getScheduleForDay(prevDayId);
        const nextSchedule = this.#getScheduleForDay(nextDayId);
        
        const currentColors = this.#getColorsForDay(dayId); 
        const prevColors = this.#getColorsForDay(prevDayId);
        const nextColors = this.#getColorsForDay(nextDayId);
        
        const { morningStartHour: m_start, dayStartHour: d_start, nightStartHour: n_start } = currentSchedule;

        const m_end = d_start;
        const d_end = n_start;
        const n_end = 24 + nextSchedule.morningStartHour;
        const prev_n_start = prevSchedule.nightStartHour;
        
        const m_mid = m_start + (m_end - m_start) / 2;
        const d_mid = d_start + (d_end - d_start) / 2;
        const n_mid = n_start + (n_end - n_start) / 2;
        const prev_n_mid = prev_n_start + ((24 + m_start) - prev_n_start) / 2;

        let startTime, endTime, startColors, endColors, effectiveHour = hourId;

        if (hourId >= m_start && hourId < d_start) {
            if (hourId < m_mid) {
                startTime = prev_n_mid;
                endTime = m_mid + 24; 
                startColors = prevColors.night; endColors = currentColors.morning;
                effectiveHour = hourId + 24;
            } else {
                startTime = m_mid; endTime = d_mid;
                startColors = currentColors.morning; endColors = currentColors.day;
            }
        } 
        else if (hourId >= d_start && hourId < n_start) {
            if (hourId < d_mid) {
                startTime = m_mid; endTime = d_mid;
                startColors = currentColors.morning; endColors = currentColors.day;
            } else {
                startTime = d_mid; endTime = n_mid;
                startColors = currentColors.day; endColors = currentColors.night;
            }
        } 
        else {
            effectiveHour = hourId < m_start ? hourId + 24 : hourId;
            if (effectiveHour < n_mid) {
                startTime = d_mid; endTime = n_mid;
                startColors = currentColors.day; endColors = currentColors.night;
            } else {
                const next_m_start = nextSchedule.morningStartHour;
                const next_d_start = nextSchedule.dayStartHour;
                const next_m_mid = (24 + next_m_start) + ((24 + next_d_start) - (24 + next_m_start)) / 2;

                startTime = n_mid; endTime = next_m_mid;
                startColors = currentColors.night; endColors = nextColors.morning;
            }
        }
        
        const duration = endTime - startTime;
        if (duration <= 0) return this.#interpolateColorPair(startColors, startColors, 0);
        
        const progress = effectiveHour - startTime;
        let ratio = Math.max(0.0, Math.min(1.0, progress / duration));
        return this.#interpolateColorPair(startColors, endColors, ratio);
    }
}
const ColorManager = new ColorCalculator();