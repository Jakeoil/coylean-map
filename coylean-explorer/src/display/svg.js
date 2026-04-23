import { D } from "./diagram-coords.js";

export function svgEl(tag, attrs) {
    const el = document.createElementNS(
        "http://www.w3.org/2000/svg",
        tag,
    );
    for (const [k, v] of Object.entries(attrs))
        el.setAttribute(k, v);
    return el;
}

export function diamondPts(cx, cy) {
    return `${cx},${cy - D} ${cx + D},${cy} ${cx},${cy + D} ${cx - D},${cy}`;
}
