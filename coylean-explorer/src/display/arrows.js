import { D as DEFAULT_D } from "./diagram-coords.js";

// Styled after research/arrow.svg: filled shaft with rounded cap + chevron arrowhead

// Baseline constants tuned for d = DEFAULT_D (= 48). Arrow size scales linearly
// with d so a smaller diamond still gets a proportional arrow.
const BASE_MARGIN = 4.5;
const BASE_SW = 3.75;
const BASE_HL = 18;
const BASE_HW = 9;
const BASE_ND = 6;

function consts(d) {
    const k = d / DEFAULT_D;
    return {
        ARR_MARGIN: BASE_MARGIN * k,
        ARR_SW: BASE_SW * k,
        ARR_HL: BASE_HL * k,
        ARR_HW: BASE_HW * k,
        ARR_ND: BASE_ND * k,
    };
}

export function downArrowPath(cx, cy, doubleHeaded, d = DEFAULT_D) {
    const { ARR_MARGIN, ARR_SW, ARR_HL, ARR_HW, ARR_ND } = consts(d);
    const t = cy - d + ARR_MARGIN;
    const b = cy + d - ARR_MARGIN;
    if (doubleHeaded) {
        return `M${cx},${t} L${cx + ARR_HW},${t + ARR_HL} ${cx + ARR_SW},${t + ARR_HL - ARR_ND} ${cx + ARR_SW},${b - ARR_HL + ARR_ND} ${cx + ARR_HW},${b - ARR_HL} ${cx},${b} ${cx - ARR_HW},${b - ARR_HL} ${cx - ARR_SW},${b - ARR_HL + ARR_ND} ${cx - ARR_SW},${t + ARR_HL - ARR_ND} ${cx - ARR_HW},${t + ARR_HL}Z`;
    }
    return `M${cx - ARR_SW},${t} A${ARR_SW},${ARR_SW} 0 0 1 ${cx + ARR_SW},${t} L${cx + ARR_SW},${b - ARR_HL + ARR_ND} ${cx + ARR_HW},${b - ARR_HL} ${cx},${b} ${cx - ARR_HW},${b - ARR_HL} ${cx - ARR_SW},${b - ARR_HL + ARR_ND}Z`;
}

export function rightArrowPath(cx, cy, doubleHeaded, d = DEFAULT_D) {
    const { ARR_MARGIN, ARR_SW, ARR_HL, ARR_HW, ARR_ND } = consts(d);
    const l = cx - d + ARR_MARGIN;
    const r = cx + d - ARR_MARGIN;
    if (doubleHeaded) {
        return `M${l},${cy} L${l + ARR_HL},${cy - ARR_HW} ${l + ARR_HL - ARR_ND},${cy - ARR_SW} ${r - ARR_HL + ARR_ND},${cy - ARR_SW} ${r - ARR_HL},${cy - ARR_HW} ${r},${cy} ${r - ARR_HL},${cy + ARR_HW} ${r - ARR_HL + ARR_ND},${cy + ARR_SW} ${l + ARR_HL - ARR_ND},${cy + ARR_SW} ${l + ARR_HL},${cy + ARR_HW}Z`;
    }
    return `M${l},${cy - ARR_SW} A${ARR_SW},${ARR_SW} 0 0 0 ${l},${cy + ARR_SW} L${r - ARR_HL + ARR_ND},${cy + ARR_SW} ${r - ARR_HL},${cy + ARR_HW} ${r},${cy} ${r - ARR_HL},${cy - ARR_HW} ${r - ARR_HL + ARR_ND},${cy - ARR_SW}Z`;
}

// Plain line segments (no arrowheads) spanning the same diamond extent
// the arrow shaft would cover. Used by the "line" arrow mode.
export function downLineSeg(cx, cy, d = DEFAULT_D) {
    const { ARR_MARGIN, ARR_SW } = consts(d);
    return {
        x1: cx, y1: cy - d + ARR_MARGIN,
        x2: cx, y2: cy + d - ARR_MARGIN,
        "stroke-width": 2 * ARR_SW,
        "stroke-linecap": "round",
    };
}

export function rightLineSeg(cx, cy, d = DEFAULT_D) {
    const { ARR_MARGIN, ARR_SW } = consts(d);
    return {
        x1: cx - d + ARR_MARGIN, y1: cy,
        x2: cx + d - ARR_MARGIN, y2: cy,
        "stroke-width": 2 * ARR_SW,
        "stroke-linecap": "round",
    };
}
