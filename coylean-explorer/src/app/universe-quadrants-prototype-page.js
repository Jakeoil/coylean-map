import { Seniority, Universe } from "../../coylean-core.js";
import { renderMosaic } from "../display/render-mosaic.js";
import { attachSvgPanZoom } from "../display/svg-pan-zoom.js";
import { makeMosaicInfo } from "./mosaic-info.js";

export function init() {
    const svg = document.getElementById("diagram");
    const info = document.getElementById("info");
    const callSig = document.getElementById("call-sig");
    const seniorityBtn = document.getElementById("seniority");

    const inputs = {
        minRow: document.getElementById("minRow"),
        maxRow: document.getElementById("maxRow"),
        minCol: document.getElementById("minCol"),
        maxCol: document.getElementById("maxCol"),
        hInitCol: document.getElementById("hInitCol"),
        vInitRow: document.getElementById("vInitRow"),
    };

    const config = {
        minRow: +inputs.minRow.value,
        maxRow: +inputs.maxRow.value,
        minCol: +inputs.minCol.value,
        maxCol: +inputs.maxCol.value,
        hInitCol: +inputs.hInitCol.value,
        vInitRow: +inputs.vInitRow.value,
        seniority: Seniority.vertical(),
    };

    const flags = {
        showLabels: false,
        showArrows: true,
        showPri: false,
        showMinimize: false,
        showEncroach: false,
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
        config.hInitCol = +inputs.hInitCol.value;
        config.vInitRow = +inputs.vInitRow.value;
    }

    function render() {
        syncNumericInputs();
        const seniorityCall = config.seniority.isVertical
            ? "Seniority.vertical"
            : "Seniority.horizontal";
        callSig.textContent =
            `Universe.createUniverseQuadrants(\n` +
            `  rowRange = [${config.minRow}, ${config.maxRow}],\n` +
            `  colRange = [${config.minCol}, ${config.maxCol}],\n` +
            `  hInitCol = ${config.hInitCol},\n` +
            `  vInitRow = ${config.vInitRow},\n` +
            `  seniority = ${seniorityCall},\n` +
            `)`;

        const { nw, ne, sw, se } = Universe.createUniverseQuadrants(
            [config.minRow, config.maxRow],
            [config.minCol, config.maxCol],
            config.hInitCol,
            config.vInitRow,
            config.seniority,
        );

        // Flip flags place each quadrant's local (0,0) — the axis-adjacent
        // corner — toward the centre of the 2×2 mosaic.
        quads = [
            { p: nw, name: "nw", flipJ: true,  flipI: true  },
            { p: ne, name: "ne", flipJ: true,  flipI: false },
            { p: sw, name: "sw", flipJ: false, flipI: true  },
            { p: se, name: "se", flipJ: false, flipI: false },
        ];

        renderMosaic(svg, quads, flags, infoHooks);
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

    function wireToggle(id, key, extra) {
        document.getElementById(id).onclick = function () {
            flags[key] = !flags[key];
            this.classList.toggle("active");
            if (extra) extra();
            render();
        };
    }

    wireToggle("tog-labels", "showLabels");
    wireToggle("tog-arrows", "showArrows");
    wireToggle("tog-pri", "showPri");
    wireToggle("tog-minimize", "showMinimize");
    wireToggle("tog-encroach", "showEncroach", () => {
        if (flags.showEncroach) {
            if (!flags.showMinimize) {
                flags.showMinimize = true;
                document.getElementById("tog-minimize").classList.add("active");
            }
            if (flags.showArrows) {
                flags.showArrows = false;
                document.getElementById("tog-arrows").classList.remove("active");
            }
        }
    });
    wireToggle("tog-borders", "showBorders");

    render();

    attachSvgPanZoom(svg, svg.querySelector("g.viewport"));
}
