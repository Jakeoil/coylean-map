import { Seniority, Propagation } from "../../coylean-core.js";
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
        arrowMode: "full",
        showPri: false,
        showMinimize: false,
        encroachMode: "off",
        showFill: true,
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
        const prop = new Propagation({
            direction: "se",
            numRows: config.numRows,
            numColumns: config.numCols,
            hInitCol: config.hInitCol,
            vInitRow: config.vInitRow,
            seniority: config.seniority,
        });
        result = { downMatrix: prop.downMatrix, rightMatrix: prop.rightMatrix };
        const seniorityCall = config.seniority.isVertical
            ? "Seniority.vertical()"
            : "Seniority.horizontal()";
        callSig.textContent = `new Propagation({
  numRows: ${config.numRows},
  numColumns: ${config.numCols},
  hInitCol: ${config.hInitCol},
  vInitRow: ${config.vInitRow},
  ${seniorityCall},
})`;
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
        if (flags.encroachMode !== "off" && !flags.showMinimize) {
            flags.showMinimize = true;
            document.getElementById("tog-minimize").classList.add("active");
        }
        render();
    };
    wireToggle("tog-fill", "showFill");
    wireToggle("tog-borders", "showBorders");

    render();

    attachSvgPanZoom(svg, svg.querySelector("g.viewport"));
}
