import { D } from "./diagram-coords.js";

// Styled after research/arrow.svg: filled shaft with rounded cap + chevron arrowhead

const ARR_MARGIN = 1.5; // gap from diamond vertex to arrow tip
const ARR_SW = 1.25;    // shaft half-width
const ARR_HL = 8;       // arrowhead length (wings to tip)
const ARR_HW = 3.5;     // arrowhead half-width
const ARR_ND = 2.5;     // notch depth

export function downArrowPath(cx, cy, doubleHeaded) {
    const t = cy - D + ARR_MARGIN;
    const b = cy + D - ARR_MARGIN;
    if (doubleHeaded) {
        return `M${cx},${t} L${cx + ARR_HW},${t + ARR_HL} ${cx + ARR_SW},${t + ARR_HL - ARR_ND} ${cx + ARR_SW},${b - ARR_HL + ARR_ND} ${cx + ARR_HW},${b - ARR_HL} ${cx},${b} ${cx - ARR_HW},${b - ARR_HL} ${cx - ARR_SW},${b - ARR_HL + ARR_ND} ${cx - ARR_SW},${t + ARR_HL - ARR_ND} ${cx - ARR_HW},${t + ARR_HL}Z`;
    }
    return `M${cx - ARR_SW},${t} A${ARR_SW},${ARR_SW} 0 0 1 ${cx + ARR_SW},${t} L${cx + ARR_SW},${b - ARR_HL + ARR_ND} ${cx + ARR_HW},${b - ARR_HL} ${cx},${b} ${cx - ARR_HW},${b - ARR_HL} ${cx - ARR_SW},${b - ARR_HL + ARR_ND}Z`;
}

export function rightArrowPath(cx, cy, doubleHeaded) {
    const l = cx - D + ARR_MARGIN;
    const r = cx + D - ARR_MARGIN;
    if (doubleHeaded) {
        return `M${l},${cy} L${l + ARR_HL},${cy - ARR_HW} ${l + ARR_HL - ARR_ND},${cy - ARR_SW} ${r - ARR_HL + ARR_ND},${cy - ARR_SW} ${r - ARR_HL},${cy - ARR_HW} ${r},${cy} ${r - ARR_HL},${cy + ARR_HW} ${r - ARR_HL + ARR_ND},${cy + ARR_SW} ${l + ARR_HL - ARR_ND},${cy + ARR_SW} ${l + ARR_HL},${cy + ARR_HW}Z`;
    }
    return `M${l},${cy - ARR_SW} A${ARR_SW},${ARR_SW} 0 0 0 ${l},${cy + ARR_SW} L${r - ARR_HL + ARR_ND},${cy + ARR_SW} ${r - ARR_HL},${cy + ARR_HW} ${r},${cy} ${r - ARR_HL},${cy - ARR_HW} ${r - ARR_HL + ARR_ND},${cy - ARR_SW}Z`;
}
