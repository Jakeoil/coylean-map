import { svgEl, diamondPts } from "../display/svg.js";

// Self-contained arrow path generation, parameterized so each preset can
// drive its own (SW, HL, HW, ND) independently. Mirrors the math in
// src/display/arrows.js but takes explicit numbers instead of scaling
// from a single d.
function downPath(cx, cy, d, p, doubleHeaded) {
    const { MARGIN, SW, HL, HW, ND } = p;
    const t = cy - d + MARGIN;
    const b = cy + d - MARGIN;
    if (doubleHeaded) {
        return `M${cx},${t} L${cx + HW},${t + HL} ${cx + SW},${t + HL - ND} ${cx + SW},${b - HL + ND} ${cx + HW},${b - HL} ${cx},${b} ${cx - HW},${b - HL} ${cx - SW},${b - HL + ND} ${cx - SW},${t + HL - ND} ${cx - HW},${t + HL}Z`;
    }
    return `M${cx - SW},${t} A${SW},${SW} 0 0 1 ${cx + SW},${t} L${cx + SW},${b - HL + ND} ${cx + HW},${b - HL} ${cx},${b} ${cx - HW},${b - HL} ${cx - SW},${b - HL + ND}Z`;
}

function rightPath(cx, cy, d, p, doubleHeaded) {
    const { MARGIN, SW, HL, HW, ND } = p;
    const l = cx - d + MARGIN;
    const r = cx + d - MARGIN;
    if (doubleHeaded) {
        return `M${l},${cy} L${l + HL},${cy - HW} ${l + HL - ND},${cy - SW} ${r - HL + ND},${cy - SW} ${r - HL},${cy - HW} ${r},${cy} ${r - HL},${cy + HW} ${r - HL + ND},${cy + SW} ${l + HL - ND},${cy + SW} ${l + HL},${cy + HW}Z`;
    }
    return `M${l},${cy - SW} A${SW},${SW} 0 0 0 ${l},${cy + SW} L${r - HL + ND},${cy + SW} ${r - HL},${cy + HW} ${r},${cy} ${r - HL},${cy - HW} ${r - HL + ND},${cy - SW}Z`;
}

// Default presets seeded by scaling current arrows.js baselines
// (SW=3.75, HL=18, HW=9, ND=6) by k.
const DEFAULTS = [
    { name: "thin2",   label: "Thin 2",  k: 0.50 },
    { name: "thin1",   label: "Thin 1",  k: 0.75 },
    { name: "current", label: "Current", k: 1.00 },
    { name: "thick",   label: "Thick",   k: 1.40 },
];
const BASE = { SW: 3.75, HL: 18, HW: 9, ND: 6 };

// Tangent MARGIN for a given SW: cap of radius SW at distance MARGIN below
// the diamond's top corner is tangent to both slanted edges when
// MARGIN = SW · √2.
function tangentMargin(sw) {
    return +(sw * Math.SQRT2).toFixed(2);
}

function seedPreset(k) {
    const SW = +(BASE.SW * k).toFixed(2);
    return {
        SW,
        HL: +(BASE.HL * k).toFixed(2),
        HW: +(BASE.HW * k).toFixed(2),
        ND: +(BASE.ND * k).toFixed(2),
        MARGIN: tangentMargin(SW),
    };
}

export function init() {
    const svg = document.getElementById("gallery");
    const presetHost = document.getElementById("preset-controls");
    const diamondInput = document.getElementById("diamondD");
    const jsonOut = document.getElementById("json-out");

    const state = {
        d: +diamondInput.value,
        direction: "down",   // "down" | "right"
        form: "single",      // "single" | "double"
        mode: "full",        // "full" | "line"
        presets: DEFAULTS.map((p) => ({ ...p, ...seedPreset(p.k) })),
    };

    function buildPresetControls() {
        presetHost.innerHTML = "";
        state.presets.forEach((p, idx) => {
            const card = document.createElement("div");
            card.className = "preset-card";
            card.innerHTML = `
                <h3>${p.label} <span class="tangent-hint" data-idx="${idx}"></span></h3>
                <div class="control-row">
                    <div class="control">
                        <label>SW</label>
                        <input type="number" data-key="SW" value="${p.SW}" step="0.1" />
                    </div>
                    <div class="control">
                        <label>HL</label>
                        <input type="number" data-key="HL" value="${p.HL}" step="0.5" />
                    </div>
                    <div class="control">
                        <label>HW</label>
                        <input type="number" data-key="HW" value="${p.HW}" step="0.25" />
                    </div>
                    <div class="control">
                        <label>ND</label>
                        <input type="number" data-key="ND" value="${p.ND}" step="0.25" />
                    </div>
                </div>
                <div class="control-row" style="margin-top: 4px;">
                    <div class="control">
                        <label>MARGIN</label>
                        <input type="number" data-key="MARGIN" value="${p.MARGIN}" step="0.1" />
                    </div>
                    <div class="control" style="justify-content: flex-end;">
                        <label>&nbsp;</label>
                        <button class="btn tangent-btn" data-idx="${idx}">← tangent</button>
                    </div>
                </div>
            `;
            card.querySelectorAll("input").forEach((inp) => {
                inp.addEventListener("input", () => {
                    state.presets[idx][inp.dataset.key] = +inp.value;
                    updateTangentHints();
                    render();
                });
            });
            card.querySelector(".tangent-btn").addEventListener("click", () => {
                const pp = state.presets[idx];
                pp.MARGIN = tangentMargin(pp.SW);
                card.querySelector('input[data-key="MARGIN"]').value = pp.MARGIN;
                updateTangentHints();
                render();
            });
            presetHost.appendChild(card);
        });
        updateTangentHints();
    }

    function updateTangentHints() {
        document.querySelectorAll(".tangent-hint").forEach((el) => {
            const p = state.presets[+el.dataset.idx];
            const tm = tangentMargin(p.SW);
            const delta = +(p.MARGIN - tm).toFixed(2);
            let label, color;
            if (delta === 0)        { label = "tangent";       color = "#16a34a"; }
            else if (delta < 0)     { label = `out ${-delta}`;  color = "#9a4a4a"; }
            else                    { label = `in ${delta}`;    color = "#5a8aaa"; }
            el.textContent = `(${label})`;
            el.style.color = color;
            el.style.fontWeight = "400";
            el.style.fontSize = "0.85em";
            el.style.marginLeft = "6px";
        });
    }

    function render() {
        const d = state.d;
        const padX = 24;
        const padY = 50;
        const cellW = 2 * d + 2 * padX;
        const cellH = 2 * d + 2 * padY;
        const n = state.presets.length;
        const w = n * cellW;
        const h = cellH;
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.innerHTML = "";

        state.presets.forEach((p, i) => {
            const cx = i * cellW + cellW / 2;
            const cy = padY + d;

            // Frame diamond (host shape so the arrow has context)
            const isRight = state.direction === "right";
            svg.appendChild(svgEl("polygon", {
                points: diamondPts(cx, cy, d),
                class: `specimen-frame${isRight ? " right" : ""}`,
            }));

            const params = {
                MARGIN: p.MARGIN,
                SW: p.SW, HL: p.HL, HW: p.HW, ND: p.ND,
            };
            const doubleHeaded = state.form === "double";

            if (state.mode === "line") {
                // Line variant: shaft only, rounded caps, width = 2*SW.
                const sw2 = 2 * p.SW;
                if (state.direction === "down") {
                    svg.appendChild(svgEl("line", {
                        x1: cx, y1: cy - d + p.MARGIN,
                        x2: cx, y2: cy + d - p.MARGIN,
                        stroke: "#7a2d2d",
                        "stroke-width": sw2,
                        "stroke-linecap": "round",
                    }));
                } else {
                    svg.appendChild(svgEl("line", {
                        x1: cx - d + p.MARGIN, y1: cy,
                        x2: cx + d - p.MARGIN, y2: cy,
                        stroke: "#3d6a8a",
                        "stroke-width": sw2,
                        "stroke-linecap": "round",
                    }));
                }
            } else {
                const dPath = state.direction === "down"
                    ? downPath(cx, cy, d, params, doubleHeaded)
                    : rightPath(cx, cy, d, params, doubleHeaded);
                svg.appendChild(svgEl("path", {
                    d: dPath,
                    class: `specimen-arrow ${state.direction}`,
                }));
            }

            // Label below
            svg.appendChild(Object.assign(
                svgEl("text", {
                    x: cx, y: cy + d + 28,
                    class: "specimen-label",
                }),
                { textContent: `${p.label}  (SW=${p.SW})` },
            ));
        });

        renderJsonOut();
    }

    function renderJsonOut() {
        const obj = {};
        for (const p of state.presets) {
            obj[p.name] = {
                SW: p.SW, HL: p.HL, HW: p.HW, ND: p.ND,
                MARGIN: p.MARGIN,
            };
        }
        jsonOut.textContent = JSON.stringify(obj, null, 2);
    }

    // ── Toggles ──
    function pair(aId, bId, onA, onB) {
        const a = document.getElementById(aId);
        const b = document.getElementById(bId);
        a.onclick = () => {
            a.classList.add("active");
            b.classList.remove("active");
            onA();
            render();
        };
        b.onclick = () => {
            b.classList.add("active");
            a.classList.remove("active");
            onB();
            render();
        };
    }
    pair("dir-down", "dir-right",
        () => (state.direction = "down"),
        () => (state.direction = "right"));
    pair("form-single", "form-double",
        () => (state.form = "single"),
        () => (state.form = "double"));
    pair("mode-full", "mode-line",
        () => (state.mode = "full"),
        () => (state.mode = "line"));

    diamondInput.addEventListener("input", () => {
        state.d = +diamondInput.value;
        render();
    });

    document.getElementById("copy-btn").onclick = async () => {
        try {
            await navigator.clipboard.writeText(jsonOut.textContent);
            const btn = document.getElementById("copy-btn");
            const orig = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => (btn.textContent = orig), 1200);
        } catch (e) {
            // Fallback: select the text
            const range = document.createRange();
            range.selectNode(jsonOut);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
        }
    };

    document.getElementById("reset-btn").onclick = () => {
        state.d = 60;
        diamondInput.value = state.d;
        state.presets = DEFAULTS.map((p) => ({ ...p, ...seedPreset(p.k) }));
        buildPresetControls();
        render();
    };

    buildPresetControls();
    render();
}
