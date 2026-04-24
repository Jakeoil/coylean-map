import { D as DEFAULT_D } from "./diagram-coords.js";

export function svgEl(tag, attrs) {
    const el = document.createElementNS(
        "http://www.w3.org/2000/svg",
        tag,
    );
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        el.setAttribute(k, v);
    }
    return el;
}

export function diamondPts(cx, cy, d = DEFAULT_D) {
    return `${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`;
}
