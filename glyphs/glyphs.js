// ═══════════════════════════════════════════════════
//  Coylean Glyphs — 4×4 Section Catalog
// ═══════════════════════════════════════════════════

import { Seniority } from "../coylean-explorer/coylean-core.js";
import {
    setOffset,
    D4_NAMES,
    D4_SUFFIX,
    pairKey,
    getSectionData,
    computeMapModel,
    GLYPH_LETTERS,
    H_GLYPH_LETTERS,
    V_CLASSES,
    H_CLASSES,
    glyphLetterAt,
    orbitMemberKeys,
    getWorkingAssignments,
    setWorkingAssignments,
    setOldAssignments,
    parseAssignmentValue,
    SUFFIX_TO_D4,
    applyAssignments,
} from "./glyph-core.js";
import {
    CELL_PX,
    V_COLOR,
    H_COLOR,
    toFt,
    glyphName,
    glyphLabel,
    hGlyphLabel,
    drawGlyph,
    drawCoyleanMap,
    renderState,
    ensureBabyBlocksLoaded,
    babyBlocksReady,
} from "./glyph-render.js";

// ── Build 8×8 Grid ──

function buildGrid(tableId, prefix, seniority) {
    const table = document.getElementById(tableId);

    // Header row
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.className = "corner-label";
    corner.textContent = "right \\ down";
    headerRow.appendChild(corner);

    for (let r = 0; r < 8; r++) {
        const th = document.createElement("th");
        th.className = "col-header";
        th.textContent = r + " = " + r.toString(2).padStart(3, "0");
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Data rows
    const tbody = document.createElement("tbody");
    for (let d = 0; d < 8; d++) {
        const row = document.createElement("tr");

        const rowHeader = document.createElement("th");
        rowHeader.className = "row-header";
        rowHeader.textContent = d + " = " + d.toString(2).padStart(3, "0");
        row.appendChild(rowHeader);

        for (let r = 0; r < 8; r++) {
            const td = document.createElement("td");
            td.dataset.grid = prefix; // "V" / "H" — for the assignment editor
            td.dataset.d = d;
            td.dataset.r = r;
            const canvas = document.createElement("canvas");
            let ft = null;
            if (seniority.isVertical) {
                ft = toFt(GLYPH_LETTERS[d + "," + r], V_COLOR);
            } else {
                ft = toFt(H_GLYPH_LETTERS[d + "," + r], H_COLOR);
            }
            drawGlyph(canvas, d, r, seniority, ft);
            td.appendChild(canvas);
            const label = document.createElement("div");
            label.className = "glyph-label";
            label.textContent = glyphName(prefix, d, r);
            td.appendChild(label);
            row.appendChild(td);
        }
        tbody.appendChild(row);
    }
    table.appendChild(tbody);
}

// (Canvas D4 matrices, glyph/map drawing, Baby Blocks live in glyph-render.js.)

// One D4 equivalence-class group as an .eq-group element. Each cell carries
// data-grid/d/r so the assignment editor can select + click it.
function buildGroupEl(cls, prefix, seniority) {
    const group = document.createElement("div");
    group.className = "eq-group " + (cls.colorClass || "both");

    for (let i = 0; i < cls.orbit.length; i++) {
        const [d, r] = cls.orbit[i];
        const cell = document.createElement("div");
        cell.className = "eq-cell";
        cell.dataset.grid = prefix; // "V" / "H" — for the assignment editor
        cell.dataset.d = d;
        cell.dataset.r = r;

        const canvas = document.createElement("canvas");
        const ft2 = seniority.isVertical
            ? toFt(GLYPH_LETTERS[d + "," + r], V_COLOR)
            : toFt(H_GLYPH_LETTERS[d + "," + r], H_COLOR);
        drawGlyph(canvas, d, r, seniority, ft2);
        cell.appendChild(canvas);

        const nameLabel = document.createElement("div");
        nameLabel.className = "sym-name";
        nameLabel.textContent = glyphName(prefix, d, r);
        cell.appendChild(nameLabel);

        const transformLabel = document.createElement("div");
        transformLabel.className = "transform";
        transformLabel.textContent = D4_NAMES[cls.transforms[i]];
        cell.appendChild(transformLabel);

        group.appendChild(cell);
    }
    return group;
}

function buildEquivalenceClasses(containerId, prefix, seniority, classes) {
    const container = document.getElementById(containerId);

    // Sort by orbit size (1, 2, 4), then by rep
    const sorted = [...classes].sort((a, b) => {
        if (a.orbitSize !== b.orbitSize) return a.orbitSize - b.orbitSize;
        return pairKey(a.rep[0], a.rep[1]) - pairKey(b.rep[0], b.rep[1]);
    });

    // Pack multiple groups per line; separate lines when orbit size changes
    let lastSize = 0;
    let line = null;
    for (const cls of sorted) {
        if (cls.orbitSize !== lastSize) {
            if (lastSize > 0) {
                const sep = document.createElement("div");
                sep.className = "eq-separator";
                container.appendChild(sep);
            }
            lastSize = cls.orbitSize;
            line = null;
        }
        if (!line) {
            line = document.createElement("div");
            line.className = "eq-line";
            container.appendChild(line);
        }
        line.appendChild(buildGroupEl(cls, prefix, seniority));
    }
}

// Canonical key for an orbit (sorted member pairKeys). transpose=true keys the
// orbit's whole-map backslash dual (swap d↔r), for matching V groups to H.
function eqOrbitKey(orbit, transpose) {
    return orbit
        .map(([d, r]) => (transpose ? pairKey(r, d) : pairKey(d, r)))
        .sort((a, b) => a - b)
        .join(",");
}

// Dual-aligned view: one row per dual pair — the V group on the left, its
// whole-map backslash dual (transposed orbit) H group on the right, in fixed
// half-width columns so the duals line up. Used by the editor (#dual-eq).
function buildDualEquivalence(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const hByKey = new Map(
        H_CLASSES.map((h) => [eqOrbitKey(h.orbit, false), h]),
    );
    const vSorted = [...V_CLASSES].sort((a, b) =>
        a.orbitSize !== b.orbitSize
            ? a.orbitSize - b.orbitSize
            : pairKey(a.rep[0], a.rep[1]) - pairKey(b.rep[0], b.rep[1]),
    );

    // One flex-wrap line per orbit size so small dual pairs pack together
    // (≈4 singles / 2 doubles / 1 quad per row, as width allows), while each V
    // group stays beside its H dual.
    let lastSize = 0;
    let line = null;
    for (const vc of vSorted) {
        if (vc.orbitSize !== lastSize) {
            lastSize = vc.orbitSize;
            line = document.createElement("div");
            line.className = "eq-pair-line";
            container.appendChild(line);
        }
        const hc = hByKey.get(eqOrbitKey(vc.orbit, true));

        const pair = document.createElement("div");
        pair.className = "eq-dual-row"; // V group | sep | H dual — a compact unit
        pair.appendChild(buildGroupEl(vc, "V", Seniority.vertical()));
        const sep = document.createElement("div");
        sep.className = "eq-dual-sep";
        pair.appendChild(sep);
        if (hc) pair.appendChild(buildGroupEl(hc, "H", Seniority.horizontal()));

        line.appendChild(pair);
    }
}

// ── Translation Table ──

function buildTranslationTable(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const o5 = getSectionData(32, 32, Seniority.vertical());
    const o6 = getSectionData(64, 64, Seniority.vertical());

    const grid = document.createElement("div");
    grid.className = "trans-grid";

    const seen = new Set();
    for (let sr5 = 0; sr5 < 8; sr5++) {
        for (let sc5 = 0; sc5 < 8; sc5++) {
            const [dc5, rc5] = o5.codes[sr5][sc5];
            const ft5 = GLYPH_LETTERS[dc5 + "," + rc5];
            if (!ft5) continue;
            const parent = glyphLabel(dc5, rc5);
            if (seen.has(parent)) continue;
            seen.add(parent);

            const sr6 = sr5 * 2,
                sc6 = sc5 * 2;
            const children = [
                [sr6, sc6],
                [sr6, sc6 + 1],
                [sr6 + 1, sc6],
                [sr6 + 1, sc6 + 1],
            ];
            const labels = children.map(([r, c]) =>
                glyphLabel(o6.codes[r][c][0], o6.codes[r][c][1]),
            );

            // Boundary segments between the 2×2 children
            const vSepTop = o6.vBound[sr6][sc6];
            const vSepBot = o6.vBound[sr6 + 1][sc6];
            const hSepLeft = o6.hBound[sr6][sc6];
            const hSepRight = o6.hBound[sr6][sc6 + 1];

            const card = document.createElement("div");
            card.className = "trans-card";

            const title = document.createElement("div");
            title.className = "trans-parent";
            title.textContent = parent;
            card.appendChild(title);

            const box = document.createElement("div");
            box.className = "trans-2x2";
            const classes = [
                [
                    hSepLeft ? "border-bottom" : "",
                    vSepTop ? "border-right" : "",
                ],
                [hSepRight ? "border-bottom" : "", ""],
                ["", vSepBot ? "border-right" : ""],
                ["", ""],
            ];
            for (let i = 0; i < 4; i++) {
                const cell = document.createElement("div");
                cell.className =
                    "trans-cell" +
                    (classes[i][0] ? " " + classes[i][0] : "") +
                    (classes[i][1] ? " " + classes[i][1] : "");
                cell.textContent = labels[i];
                box.appendChild(cell);
            }
            card.appendChild(box);
            grid.appendChild(card);
        }
    }
    container.appendChild(grid);
}

// ── V↔H Substitution Rules ──
//
// V→H: each V section in 5v expands into a 1×2 horizontal pair of H sections
// in the asymmetric H-priority intermediate (5h: 32 rows × 64 cols, r[0]=true seed).
// H→V: each H section in 5h expands into a 2×1 vertical pair of V sections in 6v.
// Composing V→H→V reproduces the existing 5→6 V→V 2×2 substitution.

function buildSubstitutionRules(vhContainerId, hvContainerId) {
    const o5 = getSectionData(32, 32, Seniority.vertical());
    const o5h = getSectionData(32, 64, Seniority.horizontal());
    const o6 = getSectionData(64, 64, Seniority.vertical());

    function makeCard(parentLabel, childLabels, sep, layoutClass, sepClass) {
        const card = document.createElement("div");
        card.className = "trans-card";
        const title = document.createElement("div");
        title.className = "trans-parent";
        title.textContent = parentLabel;
        card.appendChild(title);
        const box = document.createElement("div");
        box.className = layoutClass;
        for (let i = 0; i < childLabels.length; i++) {
            const cell = document.createElement("div");
            cell.className =
                "trans-cell" + (i === 0 && sep ? " " + sepClass : "");
            cell.textContent = childLabels[i];
            box.appendChild(cell);
        }
        card.appendChild(box);
        return card;
    }

    // V → H (1×2 horizontal pair)
    const vhContainer = document.getElementById(vhContainerId);
    if (vhContainer) {
        vhContainer.innerHTML = "";
        const grid = document.createElement("div");
        grid.className = "trans-grid";
        const seen = new Set();
        for (let sr = 0; sr < 8; sr++) {
            for (let sc = 0; sc < 8; sc++) {
                const [dc, rc] = o5.codes[sr][sc];
                const parent = glyphLabel(dc, rc);
                if (seen.has(parent)) continue;
                seen.add(parent);
                const ha = o5h.codes[sr][2 * sc];
                const hb = o5h.codes[sr][2 * sc + 1];
                const sep = o5h.vBound[sr][2 * sc];
                grid.appendChild(
                    makeCard(
                        parent,
                        [hGlyphLabel(ha[0], ha[1]), hGlyphLabel(hb[0], hb[1])],
                        sep,
                        "trans-1x2",
                        "border-right",
                    ),
                );
            }
        }
        vhContainer.appendChild(grid);
    }

    // H → V (2×1 vertical pair)
    const hvContainer = document.getElementById(hvContainerId);
    if (hvContainer) {
        hvContainer.innerHTML = "";
        const grid = document.createElement("div");
        grid.className = "trans-grid";
        const seen = new Set();
        for (let sr = 0; sr < 8; sr++) {
            for (let sc = 0; sc < 16; sc++) {
                const [dc, rc] = o5h.codes[sr][sc];
                const parent = hGlyphLabel(dc, rc);
                if (seen.has(parent)) continue;
                seen.add(parent);
                const va = o6.codes[2 * sr][sc];
                const vb = o6.codes[2 * sr + 1][sc];
                const sep = o6.hBound[2 * sr][sc];
                grid.appendChild(
                    makeCard(
                        parent,
                        [glyphLabel(va[0], va[1]), glyphLabel(vb[0], vb[1])],
                        sep,
                        "trans-2x1",
                        "border-bottom",
                    ),
                );
            }
        }
        hvContainer.appendChild(grid);
    }
}

// ── Assignment loading (IO) ──
// The assignment dicts + model (DEFAULT/NEW/OLD, parsing, accessors) live in
// glyph-core.js. The controller fetches the files and pushes them into core.

// Fetch one assignment file and return its member-index dict, or null on any
// failure. cache:"no-store" so editing the file and refreshing takes effect.
async function fetchAssignmentDict(path) {
    try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (data && data.assignments && typeof data.assignments === "object") {
            return data.assignments;
        }
        throw new Error("no .assignments object");
    } catch (e) {
        console.warn("glyphs: could not load", path + ";", "using fallback.", e);
        return null;
    }
}

// Load both schemes from their own files. New falls back to the built-in
// DEFAULT_ASSIGNMENTS; old stays null so applyAssignmentsAndRender falls back to
// the hard-coded applyOldAssignments baseline.
async function loadAssignments() {
    const [newDict, oldDict] = await Promise.all([
        fetchAssignmentDict("./assignments.json"),
        fetchAssignmentDict("./assignments-old.json"),
    ]);
    if (newDict) setWorkingAssignments(newDict);
    if (oldDict) setOldAssignments(oldDict);
}

// Per-map baby blocks state
const mapBBState = {
    "coylean-map": { bb: false, outline: true },
    "coylean-map-6h": { bb: false, outline: true },
    "coylean-map-6": { bb: false, outline: true },
};

const mapConfigs = {
    "coylean-map": { Nr: 32, Nc: 32, cell: CELL_PX, seniority: Seniority.vertical() },
    "coylean-map-6h": { Nr: 64, Nc: 64, cell: 8, seniority: Seniority.horizontal() },
    "coylean-map-6": { Nr: 64, Nc: 64, cell: 8, seniority: Seniority.vertical() },
};

function redrawMap(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const st = mapBBState[id];
    const cfg = mapConfigs[id];
    const model = computeMapModel(cfg.Nr, cfg.Nc, { seniority: cfg.seniority });
    drawCoyleanMap(el, model, {
        cell: cfg.cell,
        babyBlocks: st.bb,
        outline: st.outline,
    });
}

function applyAssignmentsAndRender(useNew) {
    applyAssignments(useNew); // core: rebuild D4 classes + letter model

    for (const id of Object.keys(mapConfigs)) {
        if (document.getElementById(id)) redrawMap(id);
    }
    buildTranslationTable("translation-table");
    buildSubstitutionRules("vh-sub-table", "hv-sub-table");
    rebuildGrids();
}

// ── Build grids ──

// Catalog (index.html) has separate v-/h-eq-classes; the editor (assign.html)
// has a single dual-aligned #dual-eq. Build whichever containers exist.
function rebuildGrids() {
    for (const id of [
        "v-grid",
        "h-grid",
        "v-eq-classes",
        "h-eq-classes",
        "dual-eq",
    ]) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
    }
    if (document.getElementById("v-grid")) {
        buildGrid("v-grid", "V", Seniority.vertical());
    }
    if (document.getElementById("h-grid")) {
        buildGrid("h-grid", "H", Seniority.horizontal());
    }
    if (document.getElementById("v-eq-classes")) {
        buildEquivalenceClasses(
            "v-eq-classes", "V", Seniority.vertical(), V_CLASSES,
        );
    }
    if (document.getElementById("h-eq-classes")) {
        buildEquivalenceClasses(
            "h-eq-classes", "H", Seniority.horizontal(), H_CLASSES,
        );
    }
    buildDualEquivalence("dual-eq");
}

// ── Baby Blocks + Outline (global: all maps and grids) ──

// Mirror the global render state into every map, then redraw maps and grids.
function applyBabyBlocks() {
    for (const id of Object.keys(mapBBState)) {
        mapBBState[id].bb = renderState.useBabyBlocks;
        mapBBState[id].outline = renderState.babyBlocksOutline;
    }
    for (const id of Object.keys(mapConfigs)) {
        if (document.getElementById(id)) redrawMap(id);
    }
    rebuildGrids();
}

const bbToggle = document.getElementById("bb-toggle");
const bbOutline = document.getElementById("bb-outline");

if (bbToggle) {
    bbToggle.addEventListener("change", function () {
        renderState.useBabyBlocks = this.checked;
        if (renderState.useBabyBlocks && !babyBlocksReady()) {
            ensureBabyBlocksLoaded(applyBabyBlocks);
        } else {
            applyBabyBlocks();
        }
    });
}

if (bbOutline) {
    bbOutline.addEventListener("change", function () {
        renderState.babyBlocksOutline = this.checked;
        applyBabyBlocks();
    });
}

// ── Assignment toggle (chicken switch) ──

const newAssignToggle = document.getElementById("new-assignment-toggle");
let useNewAssignments = newAssignToggle ? newAssignToggle.checked : true;
if (newAssignToggle) {
    newAssignToggle.addEventListener("change", function () {
        useNewAssignments = this.checked;
        applyAssignmentsAndRender(useNewAssignments);
    });
}

// ── Show-indices toggle (maps show V##/H## instead of letters) ──

const showIndicesToggle = document.getElementById("show-indices-toggle");
renderState.showIndices = showIndicesToggle
    ? showIndicesToggle.checked
    : false;
if (showIndicesToggle) {
    showIndicesToggle.addEventListener("change", function () {
        renderState.showIndices = this.checked;
        for (const id of Object.keys(mapConfigs)) {
            if (document.getElementById(id)) redrawMap(id);
        }
    });
}

// ── Tie-break offset inputs (hInitCol / vInitRow — catalog + maps) ──

const hInitInput = document.getElementById("hinit-input");
const vInitInput = document.getElementById("vinit-input");

function readOffset(el, fallback) {
    const n = parseInt(el.value, 10);
    return Number.isFinite(n) ? n : fallback;
}

if (hInitInput && vInitInput) {
    const onOffsetChange = function () {
        setOffset(readOffset(hInitInput, 1), readOffset(vInitInput, 1));
        applyAssignmentsAndRender(useNewAssignments);
    };
    hInitInput.addEventListener("change", onOffsetChange);
    vInitInput.addEventListener("change", onOffsetChange);
}

const whenLoaded = loadAssignments().then(() =>
    applyAssignmentsAndRender(useNewAssignments),
);

// ── Editor API ──
// Consumed by assign.mjs; index.html's <script type="module"> tag ignores these
// exports. whenLoaded resolves after the initial file-driven render, so the
// editor can layer its localStorage override without a render race.
export {
    applyAssignmentsAndRender,
    getWorkingAssignments,
    setWorkingAssignments,
    glyphLetterAt,
    orbitMemberKeys,
    parseAssignmentValue,
    SUFFIX_TO_D4,
    D4_SUFFIX,
    whenLoaded,
};
