// Color theme for prototype diagrams.
//
// Two themes: "legacy" (the original hand-picked hexes) and "oklch" (role
// ramps from meta/oklch.html). Render code reads theme.row.* / theme.col.*
// at draw time, so a toggle just mutates `theme` and the next render picks
// it up — no signature changes.
//
// Roles currently consumed:
//   outline  — diamond border stroke; reaction-glyph ↓/→ color
//   shadow   — arrow fill (heads and lines)
//   glow     — diamond fill, and label-bg gradient
//   gaudy    — saturated override for the editable-init arrows
// base / highlight are defined for future use (e.g. selected-state fill).
//
// Swapping rowFamily to amber or colFamily to violet is one call to
// setFamilies("amber", "violet") — see meta/oklch.html for ramp definitions.

const ramps = {
    red: {
        outline:   "oklch(34% 0.18 25)",
        shadow:    "oklch(25% 0.13 25)",
        base:      "oklch(57% 0.22 25)",
        highlight: "oklch(74% 0.16 25)",
        glow:      "oklch(88% 0.08 25)",
        gaudy:     "oklch(68% 0.34 25)",
    },
    amber: {
        outline:   "oklch(36% 0.11 70)",
        shadow:    "oklch(27% 0.08 70)",
        base:      "oklch(64% 0.16 70)",
        highlight: "oklch(78% 0.12 70)",
        glow:      "oklch(90% 0.07 70)",
        gaudy:     "oklch(78% 0.25 82)",
    },
    green: {
        outline:   "oklch(34% 0.12 145)",
        shadow:    "oklch(25% 0.09 145)",
        base:      "oklch(58% 0.16 145)",
        highlight: "oklch(74% 0.12 145)",
        glow:      "oklch(88% 0.07 145)",
        gaudy:     "oklch(74% 0.32 145)",
    },
    blue: {
        outline:   "oklch(34% 0.15 260)",
        shadow:    "oklch(25% 0.11 260)",
        base:      "oklch(58% 0.19 260)",
        highlight: "oklch(74% 0.13 260)",
        glow:      "oklch(88% 0.07 260)",
        gaudy:     "oklch(70% 0.31 260)",
    },
    violet: {
        outline:   "oklch(34% 0.16 305)",
        shadow:    "oklch(25% 0.12 305)",
        base:      "oklch(58% 0.20 305)",
        highlight: "oklch(74% 0.14 305)",
        glow:      "oklch(88% 0.08 305)",
        gaudy:     "oklch(70% 0.33 305)",
    },
};

// Legacy: original hand-tuned hexes preserved verbatim so toggling back
// reproduces the previous look exactly.
const legacyRow = {
    outline:   "#9a4a4a",
    shadow:    "#7a2d2d",
    base:      "#9a4a4a",
    highlight: "#e0a8a8",
    glow:      "#e0a8a8",
    gaudy:     "#f00",
};
const legacyCol = {
    outline:   "#5a8aaa",
    shadow:    "#3d6a8a",
    base:      "#5a8aaa",
    highlight: "#bcd8e8",
    glow:      "#bcd8e8",
    gaudy:     "#00f",
};

export const RAMPS = ramps;
export const FAMILY_NAMES = Object.keys(ramps);

// Mutable singleton — render code reads theme.row.* at draw time.
export const theme = {
    mode: "legacy",
    row: legacyRow,
    col: legacyCol,
};

export function setMode(mode) {
    theme.mode = mode;
    if (mode === "legacy") {
        theme.row = legacyRow;
        theme.col = legacyCol;
    } else {
        theme.row = ramps.red;
        theme.col = ramps.blue;
    }
    publishCssVars();
}

// Swap which OKLCH ramps drive row / col. Implicitly switches to oklch mode.
export function setFamilies(rowFamily, colFamily) {
    theme.mode = "oklch";
    theme.row = ramps[rowFamily];
    theme.col = ramps[colFamily];
    publishCssVars();
}

const ROLES = ["outline", "shadow", "base", "highlight", "glow", "gaudy"];

// Mirror onto :root CSS custom properties so HTML markup (legend swatches,
// inline <style>) can use var(--row-glow) without importing this module.
function publishCssVars() {
    if (typeof document === "undefined") return;
    const r = document.documentElement.style;
    for (const role of ROLES) {
        r.setProperty(`--row-${role}`, theme.row[role]);
        r.setProperty(`--col-${role}`, theme.col[role]);
    }
}

publishCssVars();
