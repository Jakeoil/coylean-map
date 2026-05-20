import { Propagation, Seniority, Universe } from "../../coylean-core.js";
import { renderIntegrated, renderMosaic } from "../display/render-mosaic.js";
import { attachSvgPanZoom } from "../display/svg-pan-zoom.js";
import { saveSvgFullExtent } from "../display/save-svg.js";
import { boolsToHex, hexToBools } from "./init-hex.js";
import { makeMosaicInfo } from "./mosaic-info.js";
import { attachWheelStep } from "./wheel-input.js";

export function init() {
    const svg = document.getElementById("diagram");
    const info = document.getElementById("info");
    const callSig = document.getElementById("call-sig");
    const seniorityBtn = document.getElementById("seniority");
    const modeBtn = document.getElementById("mode");
    const viewBtn = document.getElementById("view");
    const initModeBtn = document.getElementById("init-mode");
    const rangeControls = document.getElementById("range-controls");
    const extentsControls = document.getElementById("extents-controls");

    const numericInputs = {
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
        maxPri: document.getElementById("maxPri"),
    };
    const hexInputs = {
        westInitDown:   document.getElementById("westInitDown"),
        eastInitDown:   document.getElementById("eastInitDown"),
        northInitRight: document.getElementById("northInitRight"),
        southInitRight: document.getElementById("southInitRight"),
    };

    // Effective extents: in extents mode read directly from the extent
    // inputs; in range mode derive from minRow/maxRow/minCol/maxCol.
    function readEffectiveExtents() {
        if (config.mode === "range") {
            return {
                northExtent: 1 - config.minRow,
                southExtent: config.maxRow + 1,
                westExtent:  1 - config.minCol,
                eastExtent:  config.maxCol + 1,
            };
        }
        return {
            northExtent: config.northExtent,
            southExtent: config.southExtent,
            westExtent:  config.westExtent,
            eastExtent:  config.eastExtent,
        };
    }

    const config = {
        mode: "extents", // "range" | "extents"
        view: "mosaic", // "mosaic" | "integrated"
        minRow: +numericInputs.minRow.value,
        maxRow: +numericInputs.maxRow.value,
        minCol: +numericInputs.minCol.value,
        maxCol: +numericInputs.maxCol.value,
        northExtent: +numericInputs.northExtent.value,
        southExtent: +numericInputs.southExtent.value,
        westExtent:  +numericInputs.westExtent.value,
        eastExtent:  +numericInputs.eastExtent.value,
        hInitCol: +numericInputs.hInitCol.value,
        vInitRow: +numericInputs.vInitRow.value,
        maxPri: +numericInputs.maxPri.value,
        seniority: Seniority.vertical(),
        // Shared central-axis init arrays. Each is the initDown / initRight
        // of the two quadrants that touch that side. Default all-true at
        // the matching effective extent.
        westInitDown:   Array(+numericInputs.westExtent.value).fill(true),
        eastInitDown:   Array(+numericInputs.eastExtent.value).fill(true),
        northInitRight: Array(+numericInputs.northExtent.value).fill(true),
        southInitRight: Array(+numericInputs.southExtent.value).fill(true),
    };

    // Track effective extents from the previous render so syncNumericInputs
    // can detect which ones actually changed and resize only those arrays.
    let prevExtents = readEffectiveExtents();

    let initMode = "show";

    const flags = {
        showLabels: false,
        arrowMode: "full",
        showReactionLabels: false,
        priorityArrows: false,
        showMinimize: false,
        encroachMode: "off",
        showFill: true,
        showBorders: false,
        pipesMode: "off",         // "off" | "pipes" | "priority"
        pipesSize: 25,            // percentage 0–100
        initEditable: false,
    };

    let quads = [];

    const infoHooks = makeMosaicInfo(info, () => ({ quads }));

    // Init-cell click hooks. Each click toggles one entry in the shared
    // central-axis array; the next render shows the change in *both*
    // quadrants that consume that array.
    const clickHooks = {
        onClickDown: (name, i, _j) => {
            const arr = (name === "nw" || name === "sw")
                ? config.westInitDown
                : config.eastInitDown;
            arr[i] = !arr[i];
            render();
        },
        onClickRight: (name, _i, j) => {
            const arr = (name === "nw" || name === "ne")
                ? config.northInitRight
                : config.southInitRight;
            arr[j] = !arr[j];
            render();
        },
    };

    // Resize a boolean array to `len`: extend with `true`, truncate from end.
    // Matches the implicit Propagation default (missing init defaults to true).
    function resizeBools(arr, len) {
        if (arr.length === len) return arr;
        if (arr.length < len) {
            return arr.concat(Array(len - arr.length).fill(true));
        }
        return arr.slice(0, len);
    }

    function syncNumericInputs() {
        // Range endpoints clamp to ±1 so a side can collapse to zero
        // extent (minRow=1 ⇒ no north, maxRow=-1 ⇒ no south, etc).
        let minRow = +numericInputs.minRow.value;
        let maxRow = +numericInputs.maxRow.value;
        let minCol = +numericInputs.minCol.value;
        let maxCol = +numericInputs.maxCol.value;
        if (minRow > 1) minRow = 1;
        if (maxRow < -1) maxRow = -1;
        if (minCol > 1) minCol = 1;
        if (maxCol < -1) maxCol = -1;
        config.minRow = minRow;
        config.maxRow = maxRow;
        config.minCol = minCol;
        config.maxCol = maxCol;
        config.northExtent = +numericInputs.northExtent.value;
        config.southExtent = +numericInputs.southExtent.value;
        config.westExtent  = +numericInputs.westExtent.value;
        config.eastExtent  = +numericInputs.eastExtent.value;
        config.hInitCol = +numericInputs.hInitCol.value;
        config.vInitRow = +numericInputs.vInitRow.value;
        config.maxPri = +numericInputs.maxPri.value;

        // Resize each shared init array if its driving extent changed.
        const eff = readEffectiveExtents();
        if (eff.northExtent !== prevExtents.northExtent) {
            config.northInitRight = resizeBools(config.northInitRight, eff.northExtent);
        }
        if (eff.southExtent !== prevExtents.southExtent) {
            config.southInitRight = resizeBools(config.southInitRight, eff.southExtent);
        }
        if (eff.westExtent !== prevExtents.westExtent) {
            config.westInitDown = resizeBools(config.westInitDown, eff.westExtent);
        }
        if (eff.eastExtent !== prevExtents.eastExtent) {
            config.eastInitDown = resizeBools(config.eastInitDown, eff.eastExtent);
        }
        prevExtents = eff;
    }

    function paintInitInputs() {
        hexInputs.westInitDown.value   = boolsToHex(config.westInitDown);
        hexInputs.eastInitDown.value   = boolsToHex(config.eastInitDown);
        hexInputs.northInitRight.value = boolsToHex(config.northInitRight);
        hexInputs.southInitRight.value = boolsToHex(config.southInitRight);
        for (const el of Object.values(hexInputs)) el.classList.remove("error");
    }

    function render() {
        syncNumericInputs();
        const seniorityCall = config.seniority.isVertical
            ? "Seniority.vertical"
            : "Seniority.horizontal";

        const initArrays = {
            westInitDown:   config.westInitDown,
            eastInitDown:   config.eastInitDown,
            northInitRight: config.northInitRight,
            southInitRight: config.southInitRight,
        };
        const initSig =
            `  westInitDown   = ${boolsToHex(config.westInitDown)},\n` +
            `  eastInitDown   = ${boolsToHex(config.eastInitDown)},\n` +
            `  northInitRight = ${boolsToHex(config.northInitRight)},\n` +
            `  southInitRight = ${boolsToHex(config.southInitRight)},\n`;

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
                initSig +
                `  { maxPri: ${config.maxPri} },\n` +
                `)`;
            result = Universe.createUniverseQuadrants(
                [config.minRow, config.maxRow],
                [config.minCol, config.maxCol],
                config.hInitCol,
                config.vInitRow,
                config.seniority,
                initArrays,
                { maxPri: config.maxPri },
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
                initSig +
                `  { maxPri: ${config.maxPri} },\n` +
                `)`;
            result = Universe.createUniverseExtents(
                config.northExtent,
                config.southExtent,
                config.westExtent,
                config.eastExtent,
                config.hInitCol,
                config.vInitRow,
                config.seniority,
                initArrays,
                { maxPri: config.maxPri },
            );
        }
        const { nw, ne, sw, se } = result;

        // Flip flags place each quadrant's local (0,0) — the axis-adjacent
        // corner — toward the centre of the 2×2 mosaic. Filter out
        // quadrants suppressed by zero-valued extents.
        // prettier-ignore
        const baseQuads = [
            { p: nw, name: "nw", flipJ: true,  flipI: true  },
            { p: ne, name: "ne", flipJ: true,  flipI: false },
            { p: sw, name: "sw", flipJ: false, flipI: true  },
            { p: se, name: "se", flipJ: false, flipI: false },
        ].filter((q) => q.p);

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
            // Integrated view: clicks not wired (deferred — its boundary
            // arrays are derived from the universe, not the shared central
            // arrays the sidebar edits).
            renderIntegrated(svg, baseQuads, integrated, flags, infoHooks);
        } else {
            quads = baseQuads;
            callSig.textContent = baseSig;
            // Click hooks attach only in Set mode; Show mode is read-only.
            const hooks = flags.initEditable
                ? { ...infoHooks, ...clickHooks }
                : infoHooks;
            renderMosaic(svg, baseQuads, flags, hooks);
        }
        paintInitInputs();
        infoHooks.showDefault();
    }

    // Numeric inputs render on every keystroke; hex inputs commit on change only.
    for (const [key, inp] of Object.entries(numericInputs)) {
        inp.addEventListener("input", render);
        attachWheelStep(inp, { invert: key === "southExtent" });
    }

    function commitHex(inputEl, extentKey, arrayKey) {
        const parsed = hexToBools(inputEl.value);
        if (parsed === null) {
            inputEl.classList.add("error");
            return;
        }
        if (config.mode === "extents") {
            // Hex input drives the matching extent (rounds to nearest
            // multiple of 4). Update the extent input so the next
            // syncNumericInputs sees a no-op for this array.
            config[arrayKey] = parsed.bits;
            config[extentKey] = parsed.length;
            numericInputs[extentKey].value = String(parsed.length);
            prevExtents = readEffectiveExtents();
        } else {
            // Range mode: extents are derived from min/max, not from
            // the extent inputs. Force the typed bits to the current
            // effective extent — length-rounding doesn't apply.
            const eff = readEffectiveExtents();
            config[arrayKey] = resizeBools(parsed.bits, eff[extentKey]);
        }
        render();
    }

    hexInputs.westInitDown.addEventListener("change", () =>
        commitHex(hexInputs.westInitDown, "westExtent", "westInitDown"));
    hexInputs.eastInitDown.addEventListener("change", () =>
        commitHex(hexInputs.eastInitDown, "eastExtent", "eastInitDown"));
    hexInputs.northInitRight.addEventListener("change", () =>
        commitHex(hexInputs.northInitRight, "northExtent", "northInitRight"));
    hexInputs.southInitRight.addEventListener("change", () =>
        commitHex(hexInputs.southInitRight, "southExtent", "southInitRight"));
    // Enter commits (change fires on blur, so blur on Enter triggers it).
    for (const el of Object.values(hexInputs)) {
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter") el.blur();
        });
    }

    initModeBtn.onclick = () => {
        initMode = initMode === "show" ? "set" : "show";
        initModeBtn.textContent = initMode === "show" ? "Show" : "Set";
        initModeBtn.classList.toggle("active", initMode === "set");
        const readonly = initMode === "show";
        for (const el of Object.values(hexInputs)) el.readOnly = readonly;
        flags.initEditable = !readonly;
        render();
    };

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
    wireToggle("tog-reaction-labels", "showReactionLabels");
    wireToggle("tog-priority", "priorityArrows");

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

    // ── Pipes section ──
    const pipesModeBtn = document.getElementById("pipes-mode");
    const PIPES_CYCLE = ["off", "pipes", "priority"];
    const PIPES_LABEL = { off: "Off", pipes: "Pipes", priority: "Priority" };
    pipesModeBtn.onclick = () => {
        const next = (PIPES_CYCLE.indexOf(flags.pipesMode) + 1) % PIPES_CYCLE.length;
        flags.pipesMode = PIPES_CYCLE[next];
        pipesModeBtn.textContent = PIPES_LABEL[flags.pipesMode];
        pipesModeBtn.classList.toggle("active", flags.pipesMode !== "off");
        render();
    };

    const pipesSizeInput = document.getElementById("pipes-size");
    pipesSizeInput.addEventListener("input", () => {
        flags.pipesSize = +pipesSizeInput.value;
        render();
    });
    attachWheelStep(pipesSizeInput);

    document.getElementById("save-svg").onclick = () => {
        saveSvgFullExtent(
            svg,
            svg.querySelector("g.viewport"),
            "universe-quadrants.svg",
        );
    };

    render();

    attachSvgPanZoom(svg, svg.querySelector("g.viewport"));
}
