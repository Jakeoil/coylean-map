"use strict";

// ════════════════════════════════════════════════════════════════════════
// Ladder kinematics — the pure grow-and-split timeline shared by the Unbiased
// Map, the Morph Unit, and (later) the elaborate Descent animation. No DOM, no
// canvas — import into any renderer, uniform OR elaborate.
//
// One scalar `k` walks the V/H half-order ladder:
//   k=0 V0 (seed) · k=1 H0 · k=2 V1 · …   order = k>>1, seniority H = k odd.
// Between rungs the box aspect grows along its split axis toward `grow`:1
// (1.5 = 3:2 default, 2 = 2:1) then SNAPS as the cell count doubles. aspW/aspH
// are those proportions in abstract units; the page fits them to its viewport.
// ════════════════════════════════════════════════════════════════════════

// rung index k → (order, seniority). order = k>>1, seniority H = k odd. Through
// the looking-glass (D1 transpose) a page reads the V/H label swapped.
export const ladderRung = (k) => ({ order: k >> 1, seniorityH: (k & 1) === 1 });

// box proportion at rung k for snap proportion `grow` (1.5 = 3:2, 2 = 2:1).
// Every other half-order the box is square (V rungs: equal exponents) and
// between them it is a grow:1 rectangle (H rungs).
export const aspW = (k, grow) => grow ** Math.ceil(k / 2);
export const aspH = (k, grow) => grow ** Math.floor(k / 2);

// smoothstep ease + linear interpolate.
export const ease = (t) => t * t * (3 - 2 * t);
export const lerp = (a, b, t) => a + (b - a) * t;
