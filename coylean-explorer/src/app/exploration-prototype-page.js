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
        numRows: document.getElementById("numRows"),
        numCols: document.getElementById("numCols"),
        hInitCol: document.getElementById("hInitCol"),
        vInitRow: document.getElementById("vInitRow"),
    };

    const config = {
        numRows: +inputs.numRows.value,
        numCols: +inputs.numCols.value,
        hInitCol: +inputs.hInitCol.value,
        vInitRow: +inputs.vInitRow.value,
        seniority: Seniority.vertical(),
    };

    const flags = {
        showLabels: false,
        showPri: false,
        showMinimize: false,
        showEncroach: false,
    };

    let quads = [];

    const infoHooks = makeMosaicInfo(info, () => ({ quads }));

    function syncNumericInputs() {
        config.numRows = +inputs.numRows.value;
        config.numCols = +inputs.numCols.value;
        config.hInitCol = +inputs.hInitCol.value;
        config.vInitRow = +inputs.vInitRow.value;
    }

    function render() {
        syncNumericInputs();
        const seniorityCall = config.seniority.isVertical
            ? "Seniority.vertical()"
            : "Seniority.horizontal()";
        callSig.textContent =
            `Universe.createSymmetric(\n` +
            `  ${config.numRows},  // numRows\n` +
            `  ${config.numCols},  // numCols\n` +
            `  ${config.hInitCol},  // hInitCol\n` +
            `  ${config.vInitRow},  // vInitRow\n` +
            `  ${seniorityCall},\n` +
            `)  // unstitched`;

        const u = Universe.createSymmetric(
            config.numRows,
            config.numCols,
            config.hInitCol,
            config.vInitRow,
            config.seniority,
        );

        // Flip flags place each quadrant's local (0,0) — the axis-adjacent
        // corner — toward the centre of the 2×2 mosaic.
        quads = [
            { p: u.nw, name: "nw", flipJ: true,  flipI: true  },
            { p: u.ne, name: "ne", flipJ: true,  flipI: false },
            { p: u.sw, name: "sw", flipJ: false, flipI: true  },
            { p: u.se, name: "se", flipJ: false, flipI: false },
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
    wireToggle("tog-pri", "showPri");
    wireToggle("tog-minimize", "showMinimize");
    wireToggle("tog-encroach", "showEncroach", () => {
        if (flags.showEncroach && !flags.showMinimize) {
            flags.showMinimize = true;
            document.getElementById("tog-minimize").classList.add("active");
        }
    });

    render();

    attachSvgPanZoom(svg, svg.querySelector("g.viewport"));
}
