import { Seniority, Propagation } from "../../coylean-core.js";
import { renderPropagation } from "../display/render-propagation.js";
import { attachSvgPanZoom } from "../display/svg-pan-zoom.js";
import { makeInfo } from "./basic-propagation-prototype-info.js";
import { boolsToHex, hexToBools } from "./init-hex.js";
import { attachWheelStep } from "./wheel-input.js";

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
        initDown: document.getElementById("initDown"),
        initRight: document.getElementById("initRight"),
    };
    const initModeBtn = document.getElementById("init-mode");

    // Propagation input — the values that determine what propagate() produces.
    const config = {
        numRows: +inputs.numRows.value,
        numCols: +inputs.numCols.value,
        hInitCol: +inputs.hInitCol.value,
        vInitRow: +inputs.vInitRow.value,
        seniority: Seniority.vertical(),
        // Boolean init arrays (top row of downMatrix, left column of rightMatrix).
        initDown: Array(+inputs.numCols.value).fill(true),
        initRight: Array(+inputs.numRows.value).fill(true),
    };

    // "show" → text inputs are readonly mirrors of config.
    // "set"  → user can type hex; commit on blur/Enter.
    let initMode = "show";

    // Display toggles — do not affect propagation, only rendering.
    const flags = {
        showLabels: true,
        arrowMode: "full",
        showPri: false,
        showMinimize: false,
        encroachMode: "off",
        showFill: true,
        showBorders: false,
        initEditable: false, // tracks initMode === "set" for renderer
    };

    let result = null;

    const infoHooks = makeInfo(info, () => ({ config, result }));

    // Click hooks — only fire on init cells (renderPropagation enforces this).
    // Only attached when initMode === "set"; in Show mode the renderer omits
    // the click listener entirely.
    const clickHooks = {
        onClickDown: (i, _j) => {
            config.initDown[i] = !config.initDown[i];
            render();
        },
        onClickRight: (_i, j) => {
            config.initRight[j] = !config.initRight[j];
            render();
        },
    };

    // Resize a boolean array to `len`: extend with `true`, truncate from end.
    // (Matches the implicit default — Propagation fills missing init with true.)
    function resizeBools(arr, len) {
        if (arr.length === len) return arr;
        if (arr.length < len) {
            return arr.concat(Array(len - arr.length).fill(true));
        }
        return arr.slice(0, len);
    }

    function syncNumericInputs() {
        const newNumRows = +inputs.numRows.value;
        const newNumCols = +inputs.numCols.value;
        if (newNumCols !== config.numCols) {
            config.initDown = resizeBools(config.initDown, newNumCols);
        }
        if (newNumRows !== config.numRows) {
            config.initRight = resizeBools(config.initRight, newNumRows);
        }
        config.numRows = newNumRows;
        config.numCols = newNumCols;
        config.hInitCol = +inputs.hInitCol.value;
        config.vInitRow = +inputs.vInitRow.value;
    }

    function paintInitInputs() {
        // Always repaint in canonical byte-pair format, regardless of mode.
        inputs.initDown.value = boolsToHex(config.initDown);
        inputs.initRight.value = boolsToHex(config.initRight);
        inputs.initDown.classList.remove("error");
        inputs.initRight.classList.remove("error");
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
            initDown: config.initDown,
            initRight: config.initRight,
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
  initDown:  ${boolsToHex(config.initDown)},
  initRight: ${boolsToHex(config.initRight)},
  ${seniorityCall},
})`;
        paintInitInputs();
        const hooks = flags.initEditable
            ? { ...infoHooks, ...clickHooks }
            : infoHooks;
        renderPropagation(svg, config, result, flags, hooks);
    }

    // ── Controls ──

    // Numeric inputs render on every keystroke; text init inputs commit on blur/Enter only.
    for (const key of ["numRows", "numCols", "hInitCol", "vInitRow"]) {
        inputs[key].addEventListener("input", render);
        attachWheelStep(inputs[key]);
    }

    // ── Init mode toggle + hex commit ──

    initModeBtn.onclick = () => {
        initMode = initMode === "show" ? "set" : "show";
        initModeBtn.textContent = initMode === "show" ? "Show" : "Set";
        initModeBtn.classList.toggle("active", initMode === "set");
        const readonly = initMode === "show";
        inputs.initDown.readOnly = readonly;
        inputs.initRight.readOnly = readonly;
        flags.initEditable = !readonly;
        render(); // repaints diagram (init tint + click handlers) and hex inputs
    };

    function commitHex(inputEl, dimKey, arrayKey) {
        const parsed = hexToBools(inputEl.value);
        if (parsed === null) {
            inputEl.classList.add("error");
            return;
        }
        config[arrayKey] = parsed.bits;
        config[dimKey] = parsed.length;
        inputs[dimKey].value = String(parsed.length);
        render();
    }

    inputs.initDown.addEventListener("change", () =>
        commitHex(inputs.initDown, "numCols", "initDown"),
    );
    inputs.initRight.addEventListener("change", () =>
        commitHex(inputs.initRight, "numRows", "initRight"),
    );
    // Enter commits (change fires on blur, but Enter in a text input also fires change).
    for (const el of [inputs.initDown, inputs.initRight]) {
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter") el.blur();
        });
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
