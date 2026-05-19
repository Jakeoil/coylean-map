"use strict";

// Canonical OKLCH palette + helpers, shared by meta/4d pages.
// Color values mirror meta/oklch.html (the spec sketch); each family
// carries the full 5 roles: outline / shadow / base / highlight / glow.
//
// Pages with per-axis pickers must declare three <select> elements with
// ids "aColor", "bColor", "cColor"; their values must come from
// COLOR_NAMES. currentRampFor / currentAxisRamps query those elements.

/**
 * OKLCH (L 0..1, C 0..0.4ish, H degrees) → 24-bit sRGB hex.
 */
export function oklchHex(L, C, H) {
    const h = (H * Math.PI) / 180;
    const a_ = C * Math.cos(h);
    const b_ = C * Math.sin(h);
    const l_ = L + 0.3963377774 * a_ + 0.2158037573 * b_;
    const m_ = L - 0.1055613458 * a_ - 0.0638541728 * b_;
    const s_ = L - 0.089484178 * a_ - 1.291485548 * b_;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    let bv = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    const enc = (v) => {
        v = Math.max(0, Math.min(1, v));
        return v > 0.0031308
            ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055
            : 12.92 * v;
    };
    r = enc(r);
    g = enc(g);
    bv = enc(bv);
    const to8 = (v) => Math.round(v * 255);
    return (to8(r) << 16) | (to8(g) << 8) | to8(bv);
}

/**
 * Build a named ramp from a hue and a map of role → [L, C].
 * Returns { hue, [role]: hex, ... }.
 */
export function makeRamp(hue, roles) {
    const out = { hue };
    for (const [name, [L, C]] of Object.entries(roles)) {
        out[name] = oklchHex(L, C, hue);
    }
    return out;
}

export const RAMP = {
    red: makeRamp(25, {
        outline: [0.34, 0.18],
        shadow: [0.25, 0.13],
        base: [0.57, 0.22],
        highlight: [0.74, 0.16],
        glow: [0.88, 0.08],
    }),
    amber: makeRamp(70, {
        outline: [0.36, 0.11],
        shadow: [0.27, 0.08],
        base: [0.64, 0.16],
        highlight: [0.78, 0.12],
        glow: [0.9, 0.07],
    }),
    green: makeRamp(145, {
        outline: [0.34, 0.12],
        shadow: [0.25, 0.09],
        base: [0.58, 0.16],
        highlight: [0.74, 0.12],
        glow: [0.88, 0.07],
    }),
    blue: makeRamp(260, {
        outline: [0.34, 0.15],
        shadow: [0.25, 0.11],
        base: [0.58, 0.19],
        highlight: [0.74, 0.13],
        glow: [0.88, 0.07],
    }),
    violet: makeRamp(305, {
        outline: [0.34, 0.16],
        shadow: [0.25, 0.12],
        base: [0.58, 0.2],
        highlight: [0.74, 0.14],
        glow: [0.88, 0.08],
    }),
};

export const COLOR_NAMES = ["red", "amber", "green", "blue", "violet"];

/**
 * Read the current ramp for axis letter "a" | "b" | "c" from the
 * page's matching <select id="${letter}Color">.
 */
export function currentRampFor(letter) {
    return RAMP[document.getElementById(letter + "Color").value];
}

/**
 * Returns the three current axis ramps in [A, B, C] label order.
 * The mapping from these labels to a page's physical/3D axes is
 * page-specific; each page does its own remapping.
 */
export function currentAxisRamps() {
    return [
        currentRampFor("a"),
        currentRampFor("b"),
        currentRampFor("c"),
    ];
}

/**
 * Inject color-name options into a single <select> element. The
 * `selected` argument names which option starts selected.
 */
export function populateColorSelect(selectEl, selected) {
    selectEl.innerHTML = COLOR_NAMES.map(
        (name) =>
            `<option value="${name}"` +
            (name === selected ? " selected" : "") +
            `>${name}</option>`,
    ).join("");
}
