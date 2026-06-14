// Viability comparison: News 706 Bold (extracted) vs AlphabetBlocks.svg.
// Read-only scratch page — touches nothing in the working set.
import { BabyBlocks } from "../baby-blocks.js";

const SVGNS = "http://www.w3.org/2000/svg";
const BOX = 100;
const MARGIN = 12;

// Build an <svg> of `box` px containing one path, fit to its bounding box.
// getBBox needs the node attached + rendered, so caller appends first, then
// we fit in a second pass.
function makePath(d, fill, opacity = 1) {
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", fill);
    if (opacity !== 1) p.setAttribute("fill-opacity", String(opacity));
    return p;
}

function makeSvg(px) {
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("width", px);
    svg.setAttribute("height", px);
    svg.setAttribute("viewBox", `0 0 ${BOX} ${BOX}`);
    svg.classList.add("cell");
    return svg;
}

// Fit a path's bbox into the BOX viewBox (centered, MARGIN padding).
function fitPath(p) {
    const b = p.getBBox();
    if (b.width === 0 && b.height === 0) return; // empty glyph (space)
    const s = (BOX - 2 * MARGIN) / Math.max(b.width, b.height);
    const tx = MARGIN + (BOX - 2 * MARGIN - b.width * s) / 2 - b.x * s;
    const ty = MARGIN + (BOX - 2 * MARGIN - b.height * s) / 2 - b.y * s;
    p.setAttribute("transform", `matrix(${s},0,0,${s},${tx},${ty})`);
}

// Pull the raw letter path (original block coords) out of BabyBlocks.get.
function existingLetterPath(blocks, ch) {
    const svg = blocks.get(ch, { outline: false, transform: "e" });
    const p = svg.querySelector("path");
    return { d: p.getAttribute("d"), fill: p.getAttribute("fill") };
}

const fontLetters = await fetch("./font-letters.json").then((r) => r.json());
const blocks = await BabyBlocks.load("../AlphabetBlocks.svg");

// all printable ASCII the font provides
const chars = Object.keys(fontLetters);
const existingChars = new Set(blocks.chars); // the 36 already in the SVG
const tbl = document.getElementById("tbl");

const head = document.createElement("tr");
head.innerHTML =
    "<th></th><th>Font (News 706)</th><th>Existing (SVG)</th><th>Overlay</th>";
tbl.appendChild(head);

const toFit = []; // [pathEl] to fit after attach
const overlays = []; // {svg, px-independent? } actually fit handles viewBox

for (const ch of chars) {
    const tr = document.createElement("tr");

    const tdChar = document.createElement("td");
    tdChar.className = "char";
    tdChar.textContent = ch;
    tr.appendChild(tdChar);

    // Font cell
    const fontD = fontLetters[ch];
    const fontSvg = makeSvg(90);
    const fontP = makePath(fontD, "#222");
    fontSvg.appendChild(fontP);
    const tdFont = document.createElement("td");
    tdFont.appendChild(fontSvg);
    tr.appendChild(tdFont);
    toFit.push(fontP);

    // Existing cell (only the 36 chars already in AlphabetBlocks.svg)
    const hasExisting = existingChars.has(ch);
    const ex = hasExisting ? existingLetterPath(blocks, ch) : null;
    const tdEx = document.createElement("td");
    if (ex) {
        const exSvg = makeSvg(90);
        const exP = makePath(ex.d, "#222");
        exSvg.appendChild(exP);
        tdEx.appendChild(exSvg);
        toFit.push(exP);
    } else {
        tdEx.style.color = "#bbb";
        tdEx.textContent = "new";
    }
    tr.appendChild(tdEx);

    // Overlay cell — font always; existing layered on top where it exists
    const ovSvg = makeSvg(90);
    const ovFont = makePath(fontD, ex ? "#d22" : "#222", ex ? 0.5 : 1);
    ovSvg.appendChild(ovFont);
    toFit.push(ovFont);
    if (ex) {
        const ovEx = makePath(ex.d, "#0075BB", 0.5);
        ovSvg.appendChild(ovEx);
        toFit.push(ovEx);
    }
    const tdOv = document.createElement("td");
    tdOv.appendChild(ovSvg);
    tr.appendChild(tdOv);
    overlays.push(ovSvg);

    tbl.appendChild(tr);
}

// Second pass: everything is in the DOM now, so getBBox is valid.
for (const p of toFit) fitPath(p);

// Overlay-size slider just scales the overlay svgs' rendered px.
const slider = document.getElementById("ovsize");
slider.addEventListener("input", () => {
    const px = slider.value;
    for (const svg of overlays) {
        svg.setAttribute("width", px);
        svg.setAttribute("height", px);
    }
});
