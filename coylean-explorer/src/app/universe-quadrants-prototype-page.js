import { Propagation, Seniority, Universe } from "../../coylean-core.js";
import { renderIntegrated, renderMosaic } from "../display/render-mosaic.js";
import { attachSvgPanZoom } from "../display/svg-pan-zoom.js";
import { makeMosaicInfo } from "./mosaic-info.js";

export function init() {
    const svg = document.getElementById("diagram");
    const info = document.getElementById("info");
    const callSig = document.getElementById("call-sig");
    const seniorityBtn = document.getElementById("seniority");
    const modeBtn = document.getElementById("mode");
    const viewBtn = document.getElementById("view");
    const rangeControls = document.getElementById("range-controls");
    const extentsControls = document.getElementById("extents-controls");

    const inputs = {
        minRow: document.getElementById("minRow"),
        maxRow: document.getElementById("maxRow"),
        minCol: document.getElementById("minCol"),
        maxCol: document.getElementById("maxCol"),
        northExtent: document.getElementById("northExtent"),
        southExtent: document.getElementById("southExtent"),
        westExtent: document.getElementById("westExtent"),
        eastExtent: document.getElementById("eastExtent"),
        hInitCol: document.getElementById("hInitCol"),
        vInitRow: document.getElementById("vInitRow"),
    };

    const config = {
        mode: "range", // "range" | "extents"
        view: "mosaic", // "mosaic" | "integrated"
        minRow: +inputs.minRow.value,
        maxRow: +inputs.maxRow.value,
        minCol: +inputs.minCol.value,
        maxCol: +inputs.maxCol.value,
        northExtent: +inputs.northExtent.value,
        southExtent: +inputs.southExtent.value,
        westExtent: +inputs.westExtent.value,
        eastExtent: +inputs.eastExtent.value,
        hInitCol: +inputs.hInitCol.value,
        vInitRow: +inputs.vInitRow.value,
        seniority: Seniority.vertical(),
    };

    const flags = {
        showLabels: false,
        arrowMode: "full",
        showPri: false,
        showMinimize: false,
        encroachMode: "off",
        showFill: true,
        showBorders: false,
    };

    let quads = [];

    const infoHooks = makeMosaicInfo(info, () => ({ quads }));

    function syncNumericInputs() {
        // Ranges must bracket the origin.
        let minRow = +inputs.minRow.value;
        let maxRow = +inputs.maxRow.value;
        let minCol = +inputs.minCol.value;
        let maxCol = +inputs.maxCol.value;
        if (minRow > 0) minRow = 0;
        if (maxRow < 0) maxRow = 0;
        if (minCol > 0) minCol = 0;
        if (maxCol < 0) maxCol = 0;
        config.minRow = minRow;
        config.maxRow = maxRow;
        config.minCol = minCol;
        config.maxCol = maxCol;
        config.northExtent = +inputs.northExtent.value;
        config.southExtent = +inputs.southExtent.value;
        config.westExtent = +inputs.westExtent.value;
        config.eastExtent = +inputs.eastExtent.value;
        config.hInitCol = +inputs.hInitCol.value;
        config.vInitRow = +inputs.vInitRow.value;
    }

    function render() {
        syncNumericInputs();
        const seniorityCall = config.seniority.isVertical
            ? "Seniority.vertical"
            : "Seniority.horizontal";

        let result;
        let baseSig;
        if (config.mode === "range") {
            baseSig =
                `Universe.createUniverseQuadrants(\n` +
                `  rowRange = [${config.minRow}, ${config.maxRow}],\n` +
                `  colRange = [${config.minCol}, ${config.maxCol}],\n` +
                `  hInitCol = ${config.hInitCol},\n` +
                `  vInitRow = ${config.vInitRow},\n` +
                `  seniority = ${seniorityCall},\n` +
                `)`;
            result = Universe.createUniverseQuadrants(
                [config.minRow, config.maxRow],
                [config.minCol, config.maxCol],
                config.hInitCol,
                config.vInitRow,
                config.seniority,
            );
        } else {
            baseSig =
                `Universe.createUniverseExtents(\n` +
                `  northExtent = ${config.northExtent},\n` +
                `  southExtent = ${config.southExtent},\n` +
                `  westExtent  = ${config.westExtent},\n` +
                `  eastExtent  = ${config.eastExtent},\n` +
                `  hInitCol = ${config.hInitCol},\n` +
                `  vInitRow = ${config.vInitRow},\n` +
                `  seniority = ${seniorityCall},\n` +
                `)`;
            result = Universe.createUniverseExtents(
                config.northExtent,
                config.southExtent,
                config.westExtent,
                config.eastExtent,
                config.hInitCol,
                config.vInitRow,
                config.seniority,
            );
        }
        const { nw, ne, sw, se } = result;

        // Flip flags place each quadrant's local (0,0) — the axis-adjacent
        // corner — toward the centre of the 2×2 mosaic.
        const baseQuads = [
            { p: nw, name: "nw", flipJ: true,  flipI: true  },
            { p: ne, name: "ne", flipJ: true,  flipI: false },
            { p: sw, name: "sw", flipJ: false, flipI: true  },
            { p: se, name: "se", flipJ: false, flipI: false },
        ];

        if (config.view === "integrated") {
            const boundary = Propagation.fromUniverseBoundary(result);
            const integrated = {
                p: boundary,
                name: "integrated",
                flipJ: false,
                flipI: false,
            };
            quads = [...baseQuads, integrated];
            callSig.textContent =
                baseSig + `\nPropagation.fromUniverseBoundary(universe)`;
            renderIntegrated(svg, baseQuads, integrated, flags, infoHooks);
        } else {
            quads = baseQuads;
            callSig.textContent = baseSig;
            renderMosaic(svg, baseQuads, flags, infoHooks);
        }
        infoHooks.showDefault();
    }

    for (const inp of Object.values(inputs)) {
        inp.addEventListener("input", render);
    }

    seniorityBtn.addEventListener("click", () => {
        config.seniority = config.seniority.isVertical
            ? Seniority.horizontal()
            : Seniority.vertical();
        seniorityBtn.textContent = config.seniority.isVertical
            ? "Vertical"
            : "Horizontal";
        render();
    });

    modeBtn.addEventListener("click", () => {
        config.mode = config.mode === "range" ? "extents" : "range";
        const isRange = config.mode === "range";
        modeBtn.textContent = isRange ? "Range" : "Extents";
        rangeControls.hidden = !isRange;
        extentsControls.hidden = isRange;
        render();
    });

    viewBtn.addEventListener("click", () => {
        config.view = config.view === "mosaic" ? "integrated" : "mosaic";
        viewBtn.textContent =
            config.view === "mosaic" ? "Mosaic" : "Integrated";
        render();
    });

    function wireToggle(id, key, extra) {
        document.getElementById(id).onclick = function () {
            flags[key] = !flags[key];
            this.classList.toggle("active");
            if (extra) extra();
            render();
        };
    }

    wireToggle("tog-labels", "showLabels");
    wireToggle("tog-pri", "showPri");

    const arrowBtn = document.getElementById("tog-arrows");
    const ARROW_CYCLE = ["off", "full", "line"];
    arrowBtn.onclick = () => {
        const next = (ARROW_CYCLE.indexOf(flags.arrowMode) + 1) % ARROW_CYCLE.length;
        flags.arrowMode = ARROW_CYCLE[next];
        arrowBtn.classList.toggle("active", flags.arrowMode !== "off");
        arrowBtn.textContent = flags.arrowMode === "line" ? "Arrow ─" : "Arrow";
        render();
    };
    wireToggle("tog-minimize", "showMinimize");
    const encroachBtn = document.getElementById("tog-encroach");
    const ENCROACH_CYCLE = ["off", "full", "half"];
    encroachBtn.onclick = () => {
        const next = (ENCROACH_CYCLE.indexOf(flags.encroachMode) + 1) % ENCROACH_CYCLE.length;
        flags.encroachMode = ENCROACH_CYCLE[next];
        encroachBtn.classList.toggle("active", flags.encroachMode !== "off");
        encroachBtn.textContent = flags.encroachMode === "half" ? "Encroach ½" : "Encroach";
        if (flags.encroachMode !== "off") {
            if (!flags.showMinimize) {
                flags.showMinimize = true;
                document.getElementById("tog-minimize").classList.add("active");
            }
            if (flags.arrowMode !== "off") {
                flags.arrowMode = "off";
                arrowBtn.classList.remove("active");
                arrowBtn.textContent = "Arrow";
            }
        }
        render();
    };
    wireToggle("tog-fill", "showFill");
    wireToggle("tog-borders", "showBorders");

    render();

    attachSvgPanZoom(svg, svg.querySelector("g.viewport"));
}
