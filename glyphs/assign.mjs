// Assignment editor — layered on top of the glyphs.js renderer.
//
// glyphs.js renders maps + V/H grids + orbit "groups" and exposes a small
// editor API. This module adds: click-to-select (groups, grids, map sections),
// a symbol + orientation editor, localStorage persistence, and JSON download.
// Importing glyphs.js runs its guarded top-level wiring against this page's IDs.

import {
    applyAssignmentsAndRender,
    getWorkingAssignments,
    setWorkingAssignments,
    glyphLetterAt,
    orbitMemberKeys,
    SUFFIX_TO_D4,
    D4_SUFFIX,
    whenLoaded,
    ASSIGNMENT_FILES,
} from "./glyphs.js";

const STORAGE_KEY = "coylean.assignments.v1";
const MAP_IDS = ["coylean-map", "coylean-map-6h", "coylean-map-6"];

// Description embedded in a downloaded file; refreshed from the live file on
// "Load from file" so the download round-trips assignments.json faithfully.
let fileDescription =
    "Coylean glyph -> symbol assignments, edited in assign.html and " +
    "downloaded. Keys are member indices: grid letter (V or H) + down-code " +
    "digit + right-code digit (each 0-7). Naming a member makes it the " +
    "identity (state e) of its D4 group; the orbit (both grids, via the " +
    "backslash dual) follows. A trailing suffix relocates the identity: " +
    "e=identity 1,2,3=rotations -=flip(horiz mirror) |=flip(vert mirror) " +
    "\\=backslash / =slash.";

// d4 index → typed suffix char (inverse of SUFFIX_TO_D4). Index 0 is "e", but
// we emit a *bare* symbol for upright, so the suffix is only appended for d4>0.
const D4_TO_SUFFIX = {};
for (const [ch, idx] of Object.entries(SUFFIX_TO_D4)) D4_TO_SUFFIX[idx] = ch;

// ── DOM handles ──
const $ = (id) => document.getElementById(id);
const symInput = $("sym-input");
const orientSelect = $("orient-select");
const readout = $("sel-readout");
const statusLine = $("status-line");

let selected = null; // { grid, d, r }

function setStatus(msg) {
    statusLine.textContent = msg;
}

// ── localStorage ──
function saveDict(dict) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dict));
    } catch (e) {
        console.warn("assign: could not persist to localStorage", e);
    }
}
function loadSavedDict() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        return obj && typeof obj === "object" ? obj : null;
    } catch (e) {
        return null;
    }
}

// Re-render maps + grids + groups from the working dict, then re-apply the
// selection highlight (grids/groups are rebuilt from scratch each render).
function rerender() {
    applyAssignmentsAndRender(true);
    if (selected) highlight(selected.grid, selected.d, selected.r);
}

// ── Selection ──
// Highlight the exact member (grid + eq cells) AND its whole group box in the
// combined eq map, then bring that group into view — so you can read off the
// orbit and click the member with the orientation you want, instead of guessing
// the suffix dropdown.
function highlight(grid, d, r) {
    document
        .querySelectorAll(".coy-selected, .coy-group-hl, .coy-row-hl")
        .forEach((el) =>
            el.classList.remove("coy-selected", "coy-group-hl", "coy-row-hl"),
        );
    const sel = `[data-grid="${grid}"][data-d="${d}"][data-r="${r}"]`;
    document
        .querySelectorAll(sel)
        .forEach((el) => el.classList.add("coy-selected"));
    // In the dual map, red-box BOTH the picked group and its dual (the two
    // .eq-group in the pair), highlight the row, and scroll the pair into view —
    // so the orbit and its dual are visible to pick the orientation from.
    const eqHit = document.querySelector(`#dual-eq ${sel}`);
    if (eqHit) {
        const row = eqHit.closest(".eq-dual-row");
        if (row) {
            row.querySelectorAll(".eq-group").forEach((g) =>
                g.classList.add("coy-group-hl"),
            );
            row.classList.add("coy-row-hl");
        }
        eqHit.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "smooth",
        });
    }
}

function selectMember(grid, d, r) {
    selected = { grid, d, r };
    const cur = glyphLetterAt(grid, d, r); // [symbol, d4] or null
    readout.innerHTML =
        "Selected: <b>" +
        grid +
        d +
        r +
        "</b>" +
        (cur
            ? ' <span id="sel-current">(now ' +
              cur[0] +
              " " +
              (D4_SUFFIX[cur[1]] || "e") +
              ")</span>"
            : ' <span id="sel-current">(unlettered)</span>');
    // Pre-fill the current letter (typing replaces it) and default orientation
    // to e — selecting a member from the eq group IS the orientation choice: it
    // becomes the upright identity. Focus + select so you can just type to
    // assign (see the input handler in attachListeners).
    symInput.value = cur ? cur[0] : "";
    orientSelect.value = "0";
    highlight(grid, d, r);
    symInput.focus();
    symInput.select();
}

// All member keys this assignment touches: the orbit in the named grid plus the
// dual orbit (transposed codes) in the other grid. Used to keep one dict entry
// per group when re-lettering or clearing.
function affectedKeys(grid, d, r) {
    const other = grid === "V" ? "H" : "V";
    return new Set([
        ...orbitMemberKeys(grid, d, r),
        ...orbitMemberKeys(other, r, d),
    ]);
}

// ── Actions ──
function assignSelected() {
    if (!selected) {
        setStatus("Select a glyph first.");
        return;
    }
    const sym = symInput.value;
    if (!sym) {
        setStatus("Type a symbol to assign.");
        return;
    }
    const d4 = parseInt(orientSelect.value, 10) || 0;
    const value = sym + (d4 === 0 ? "" : D4_TO_SUFFIX[d4]);
    const { grid, d, r } = selected;
    const dict = getWorkingAssignments();
    // Drop any existing entry in this group, then anchor at the clicked member.
    const affected = affectedKeys(grid, d, r);
    for (const k of Object.keys(dict)) if (affected.has(k)) delete dict[k];
    dict[grid + "" + d + "" + r] = value;
    setWorkingAssignments(dict);
    saveDict(dict);
    rerender();
    setStatus("Assigned " + grid + d + r + " = " + value);
}

function clearSelectedGroup() {
    if (!selected) {
        setStatus("Select a glyph first.");
        return;
    }
    const { grid, d, r } = selected;
    const dict = getWorkingAssignments();
    const affected = affectedKeys(grid, d, r);
    let removed = 0;
    for (const k of Object.keys(dict))
        if (affected.has(k)) {
            delete dict[k];
            removed++;
        }
    setWorkingAssignments(dict);
    saveDict(dict);
    rerender();
    setStatus(removed ? "Cleared group at " + grid + d + r : "Nothing to clear.");
}

// Load the dropdown-selected file (or `key` if given) into the working dict and
// persist it — replacing local edits with that file's contents.
async function loadFromFile(key) {
    const sel = $("assignment-select");
    if (!key || typeof key !== "string") key = sel ? sel.value : "assignments";
    const path = ASSIGNMENT_FILES[key] || "./assignments.json";
    try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (data && typeof data.description === "string")
            fileDescription = data.description;
        const dict = data && data.assignments ? { ...data.assignments } : {};
        setWorkingAssignments(dict);
        saveDict(dict);
        rerender();
        setStatus(
            "Loaded " + Object.keys(dict).length + " groups from " + key + ".json",
        );
    } catch (e) {
        setStatus("Could not load " + key + ": " + e.message);
    }
}

function clearAll() {
    const dict = {};
    setWorkingAssignments(dict);
    saveDict(dict);
    rerender();
    setStatus("Cleared all assignments (blank slate).");
}

function downloadJSON() {
    const out = {
        description: fileDescription,
        assignments: getWorkingAssignments(),
    };
    const blob = new Blob([JSON.stringify(out, null, 2) + "\n"], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "assignments.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Downloaded assignments.json");
}

// ── Map-section hit-test ──
function onMapClick(canvas, e) {
    const meta = canvas._coySections;
    if (!meta) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const { firstDarkCol, firstDarkRow, cell, SEC, isVertical, secCodes } = meta;
    const sc = Math.floor((px / cell - firstDarkCol - 1) / SEC);
    const sr = Math.floor((py / cell - firstDarkRow - 1) / SEC);
    if (sr < 0 || sc < 0 || sr >= meta.NSr || sc >= meta.NSc) return;
    const [dc, rc] = secCodes[sr][sc];
    selectMember(isVertical ? "V" : "H", dc, rc);
}

// ── Wire up ──
function populateOrientations() {
    for (let i = 0; i < 8; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent =
            i === 0
                ? "e — upright"
                : (D4_SUFFIX[i] || "?") + ' — suffix "' + D4_TO_SUFFIX[i] + '"';
        orientSelect.appendChild(opt);
    }
}

function attachListeners() {
    // Grids + groups are rebuilt each render, so delegate from the document.
    document.addEventListener("click", (e) => {
        const cell = e.target.closest("[data-grid][data-d][data-r]");
        if (!cell) return;
        selectMember(cell.dataset.grid, +cell.dataset.d, +cell.dataset.r);
    });
    // Map canvases are stable elements (only redrawn), so listen once.
    for (const id of MAP_IDS) {
        const canvas = $(id);
        if (canvas) canvas.addEventListener("click", (e) => onMapClick(canvas, e));
    }
    $("assign-btn").addEventListener("click", assignSelected);
    $("clear-sel-btn").addEventListener("click", clearSelectedGroup);
    $("load-file-btn").addEventListener("click", () => loadFromFile());
    const assignmentSelect = $("assignment-select");
    if (assignmentSelect) {
        assignmentSelect.addEventListener("change", () =>
            loadFromFile(assignmentSelect.value),
        );
    }
    $("clear-all-btn").addEventListener("click", clearAll);
    $("download-btn").addEventListener("click", downloadJSON);
    // Type a symbol → assign it to the selected glyph right then and there (at
    // the picked orbit member, upright). Enter also works.
    symInput.addEventListener("input", () => {
        if (selected && symInput.value) assignSelected();
    });
    symInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") assignSelected();
    });
}

// glyphs.js renders the file defaults first (whenLoaded); then we override with
// any locally-saved edits and re-render. localStorage precedence is editor-only
// — index.html never reads it.
whenLoaded.then(() => {
    populateOrientations();
    attachListeners();
    const saved = loadSavedDict();
    if (saved) {
        setWorkingAssignments(saved);
        applyAssignmentsAndRender(true);
        setStatus("Restored " + Object.keys(saved).length + " saved groups.");
    } else {
        // Own a mutable copy of the file-loaded defaults.
        setWorkingAssignments({ ...getWorkingAssignments() });
        setStatus("Loaded defaults from assignments.json");
    }
});
