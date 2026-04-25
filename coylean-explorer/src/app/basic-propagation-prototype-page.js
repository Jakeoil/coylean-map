import { Seniority, propagate } from "../../coylean-core.js";
import { renderPropagation } from "../display/render-propagation.js";
import { attachSvgPanZoom } from "../display/svg-pan-zoom.js";
import { makeInfo } from "./basic-propagation-prototype-info.js";

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

    // Propagation input — the 5 values that determine what propagate() produces.
    const config = {
        numRows: +inputs.numRows.value,
        numCols: +inputs.numCols.value,
        hInitCol: +inputs.hInitCol.value,
        vInitRow: +inputs.vInitRow.value,
        seniority: Seniority.vertical(),
    };

    // Display toggles — do not affect propagation, only rendering.
    const flags = {
        showLabels: true,
        showArrows: true,
        showFlow: false,
        showPri: false,
        showMinimize: false,
        showEncroach: false,
        showBorders: false,
    };

    let result = null;

    const infoHooks = makeInfo(info, () => ({ config, result }));

    function syncNumericInputs() {
        config.numRows = +inputs.numRows.value;
        config.numCols = +inputs.numCols.value;
        config.hInitCol = +inputs.hInitCol.value;
        config.vInitRow = +inputs.vInitRow.value;
    }

    function render() {
        syncNumericInputs();
        result = propagate(
            config.numRows,
            config.numCols,
            config.hInitCol,
            config.vInitRow,
            config.seniority,
        );
        const seniorityCall = config.seniority.isVertical
            ? "Seniority.vertical()"
            : "Seniority.horizontal()";
        callSig.textContent = `propagate(${config.numRows}, ${config.numCols}, ${config.hInitCol}, ${config.vInitRow}, ${seniorityCall})`;
        renderPropagation(svg, config, result, flags, infoHooks);
    }

    // ── Controls ──

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

    // ── Toggle buttons ──

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
    wireToggle("tog-flow", "showFlow");
    wireToggle("tog-pri", "showPri");
    wireToggle("tog-minimize", "showMinimize");
    wireToggle("tog-encroach", "showEncroach", () => {
        if (flags.showEncroach && !flags.showMinimize) {
            flags.showMinimize = true;
            document.getElementById("tog-minimize").classList.add("active");
        }
    });
    wireToggle("tog-borders", "showBorders");

    render();

    attachSvgPanZoom(svg, svg.querySelector("g.viewport"));
}
