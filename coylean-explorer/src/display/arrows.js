import { D as DEFAULT_D } from "./diagram-coords.js";
import { pri } from "coylean/core";

// Styled after research/arrow.svg: filled shaft with rounded cap + chevron arrowhead

// Per-priority presets (tuned in meta/arrows-test.html, calibrated for d = DEFAULT_D = 48).
// Arrow size scales linearly with d: a smaller diamond gets a proportional arrow.
const PRESETS = {
    thin2:   { SW: 1.88, HL: 9,    HW: 4.5,  ND: 3,   MARGIN: 2.66 },
    thin1:   { SW: 2.81, HL: 13.5, HW: 6.75, ND: 4.5, MARGIN: 3.97 },
    current: { SW: 3.75, HL: 18,   HW: 9,    ND: 6,   MARGIN: 5.30 },
    thick:   { SW: 5.25, HL: 25.2, HW: 12.6, ND: 8.4, MARGIN: 7.42 },
};

// Map an arrow's axis priority to a thickness preset.
// pri(0) = 100 (the highest-priority axis position) → thick.
export function presetForPri(p) {
    if (p <= 1) return "thin2";
    if (p === 2) return "thin1";
    if (p === 3) return "current";
    return "thick";
}

// Convenience: derive preset directly from a column / row offset.
export function presetForOffset(n) {
    return presetForPri(pri(n));
}

function consts(d, preset = "current") {
    const k = d / DEFAULT_D;
    const base = PRESETS[preset] ?? PRESETS.current;
    return {
        ARR_MARGIN: base.MARGIN * k,
        ARR_SW: base.SW * k,
        ARR_HL: base.HL * k,
        ARR_HW: base.HW * k,
        ARR_ND: base.ND * k,
    };
}

export function downArrowPath(cx, cy, doubleHeaded, d = DEFAULT_D, preset = "current") {
    const { ARR_MARGIN, ARR_SW, ARR_HL, ARR_HW, ARR_ND } = consts(d, preset);
    const t = cy - d + ARR_MARGIN;
    const b = cy + d - ARR_MARGIN;
    if (doubleHeaded) {
        return `M${cx},${t} L${cx + ARR_HW},${t + ARR_HL} ${cx + ARR_SW},${t + ARR_HL - ARR_ND} ${cx + ARR_SW},${b - ARR_HL + ARR_ND} ${cx + ARR_HW},${b - ARR_HL} ${cx},${b} ${cx - ARR_HW},${b - ARR_HL} ${cx - ARR_SW},${b - ARR_HL + ARR_ND} ${cx - ARR_SW},${t + ARR_HL - ARR_ND} ${cx - ARR_HW},${t + ARR_HL}Z`;
    }
    return `M${cx - ARR_SW},${t} A${ARR_SW},${ARR_SW} 0 0 1 ${cx + ARR_SW},${t} L${cx + ARR_SW},${b - ARR_HL + ARR_ND} ${cx + ARR_HW},${b - ARR_HL} ${cx},${b} ${cx - ARR_HW},${b - ARR_HL} ${cx - ARR_SW},${b - ARR_HL + ARR_ND}Z`;
}

export function rightArrowPath(cx, cy, doubleHeaded, d = DEFAULT_D, preset = "current") {
    const { ARR_MARGIN, ARR_SW, ARR_HL, ARR_HW, ARR_ND } = consts(d, preset);
    const l = cx - d + ARR_MARGIN;
    const r = cx + d - ARR_MARGIN;
    if (doubleHeaded) {
        return `M${l},${cy} L${l + ARR_HL},${cy - ARR_HW} ${l + ARR_HL - ARR_ND},${cy - ARR_SW} ${r - ARR_HL + ARR_ND},${cy - ARR_SW} ${r - ARR_HL},${cy - ARR_HW} ${r},${cy} ${r - ARR_HL},${cy + ARR_HW} ${r - ARR_HL + ARR_ND},${cy + ARR_SW} ${l + ARR_HL - ARR_ND},${cy + ARR_SW} ${l + ARR_HL},${cy + ARR_HW}Z`;
    }
    return `M${l},${cy - ARR_SW} A${ARR_SW},${ARR_SW} 0 0 0 ${l},${cy + ARR_SW} L${r - ARR_HL + ARR_ND},${cy + ARR_SW} ${r - ARR_HL},${cy + ARR_HW} ${r},${cy} ${r - ARR_HL},${cy - ARR_HW} ${r - ARR_HL + ARR_ND},${cy - ARR_SW}Z`;
}

// Plain line segments (no arrowheads) spanning the same diamond extent
// the arrow shaft would cover. Used by the "line" arrow mode.
export function downLineSeg(cx, cy, d = DEFAULT_D, preset = "current") {
    const { ARR_MARGIN, ARR_SW } = consts(d, preset);
    return {
        x1: cx, y1: cy - d + ARR_MARGIN,
        x2: cx, y2: cy + d - ARR_MARGIN,
        "stroke-width": 2 * ARR_SW,
        "stroke-linecap": "round",
    };
}

export function rightLineSeg(cx, cy, d = DEFAULT_D, preset = "current") {
    const { ARR_MARGIN, ARR_SW } = consts(d, preset);
    return {
        x1: cx - d + ARR_MARGIN, y1: cy,
        x2: cx + d - ARR_MARGIN, y2: cy,
        "stroke-width": 2 * ARR_SW,
        "stroke-linecap": "round",
    };
}
