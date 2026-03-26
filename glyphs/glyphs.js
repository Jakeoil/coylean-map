// ═══════════════════════════════════════════════════
//  Coylean Glyphs — 4×4 Section Catalog
// ═══════════════════════════════════════════════════

// Canvas size for each glyph
const CELL_PX = 16;
const DOT_R = 2.5;
const MARGIN = 10;
const NUM_CELLS = 3;
const GRID_CELLS = NUM_CELLS + 1; // includes exit segment column/row
const CANVAS_SIZE = CELL_PX * GRID_CELLS + MARGIN * 2;

// ── Coylean Algorithm (duplicated from coylean.js — no module system) ──

function computeMaxPri(ds, rs) {
    if (ds < rs) ds = rs;
    for (let i = 0; i < 32; i++) {
        if (ds < 1) return i;
        ds = Math.floor(ds / 2);
    }
    return 32;
}

const MAX_PRI = computeMaxPri(NUM_CELLS, NUM_CELLS);

function priority(i) {
    for (let j = 0; j < MAX_PRI; j++) {
        if (i % 2 !== 0) return j;
        i = Math.floor(i / 2);
    }
    return MAX_PRI;
}

// ── Glyph Renderer — uses the real Coylean algorithm ──

function drawGlyph(canvas, downCode, rightCode, verticalWinsTies) {
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Initialize arrows from the 3-bit codes
    const downArrows = [
        !!(downCode & 1),
        !!(downCode & 2),
        !!(downCode & 4),
    ];
    const rightArrows = [
        !!(rightCode & 1),
        !!(rightCode & 2),
        !!(rightCode & 4),
    ];

    // Convert grid position to pixel coordinate
    function px(gridPos) {
        return MARGIN + gridPos * CELL_PX;
    }

    // Input dots
    for (let x = 0; x < 3; x++) {
        drawDot(ctx, px(x + 1), px(0), !!(downCode & (1 << x)));
    }
    for (let y = 0; y < 3; y++) {
        drawDot(ctx, px(0), px(y + 1), !!(rightCode & (1 << y)));
    }

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.2;

    let y_place = 0;
    for (let y = 0; y < NUM_CELLS; y++) {
        let x_place = 0;
        for (let x = 0; x < NUM_CELLS; x++) {
            let down = downArrows[x];
            let right = rightArrows[y];

            const downPri = priority(x + 1);
            const rightPri = priority(y + 1);

            if (verticalWinsTies ? downPri >= rightPri : downPri > rightPri) {
                if (down) right = !right;
            } else {
                if (right) down = !down;
            }

            const cx = px(0) + x_place;
            const cy = px(0) + y_place;
            const x_r = cx + CELL_PX;
            const y_b = cy + CELL_PX;

            if (downArrows[x]) {
                ctx.beginPath();
                ctx.moveTo(x_r, cy);
                ctx.lineTo(x_r, y_b);
                ctx.stroke();
            }
            if (rightArrows[y]) {
                ctx.beginPath();
                ctx.moveTo(cx, y_b);
                ctx.lineTo(x_r, y_b);
                ctx.stroke();
            }

            // Update arrows for next iteration
            downArrows[x] = down;
            rightArrows[y] = right;
            x_place += CELL_PX;
        }

        // Draw the final right value exiting the row
        if (rightArrows[y]) {
            const cx = px(0) + x_place;
            const cy = px(0) + y_place;
            const y_b = cy + CELL_PX;
            ctx.beginPath();
            ctx.moveTo(cx, y_b);
            ctx.lineTo(cx + CELL_PX, y_b);
            ctx.stroke();
        }

        y_place += CELL_PX;
    }

    for (let x = 0; x < NUM_CELLS; x++) {
        if (downArrows[x]) {
            const x_r = px(0) + (x + 1) * CELL_PX;
            const cy = px(0) + y_place;
            ctx.beginPath();
            ctx.moveTo(x_r, cy);
            ctx.lineTo(x_r, cy + CELL_PX);
            ctx.stroke();
        }
    }

    // Output dots
    for (let y = 0; y < 3; y++) {
        drawDot(ctx, px(GRID_CELLS), px(y + 1), rightArrows[y]);
    }
    for (let x = 0; x < 3; x++) {
        drawDot(ctx, px(x + 1), px(GRID_CELLS), downArrows[x]);
    }
}

function drawDot(ctx, x, y, filled) {
    ctx.beginPath();
    ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
    if (filled) {
        ctx.fillStyle = "#000";
        ctx.fill();
    } else {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }
}

// ── Build 8×8 Grid ──

function buildGrid(tableId, prefix, verticalWinsTies) {
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
            const canvas = document.createElement("canvas");
            drawGlyph(canvas, d, r, verticalWinsTies);
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

// ── D4 Symmetry Classification ──
//
// The dihedral group D4 has 8 elements acting on a square:
//   e    — identity
//   r    — 90° rotation
//   r²   — 180° rotation
//   r³   — 270° rotation
//   s_h  — reflect across horizontal axis
//   s_v  — reflect across vertical axis
//   s_d1 — reflect across main diagonal (↘)
//   s_d2 — reflect across anti-diagonal (↙)
//
// Each symmetry transforms a (down, right) code pair:
//   e    : (d, r) → (d, r)
//   r    : (d, r) → (r, rev(d))
//   r²   : (d, r) → (rev(d), rev(r))
//   r³   : (d, r) → (rev(r), d)
//   s_h  : (d, r) → (rev(d), r)
//   s_v  : (d, r) → (d, rev(r))
//   s_d1 : (d, r) → (r, d)
//   s_d2 : (d, r) → (rev(r), rev(d))
//
// reverse(code) flips bit 0 ↔ bit 2, bit 1 stays (mirror about center).

// Reverse 3-bit code: swap bit 0 and bit 2, bit 1 stays
function reverse3(code) {
    const b0 = code & 1;
    const b1 = code & 2;
    const b2 = code & 4;
    return (b0 << 2) | b1 | (b2 >> 2);
}

// D4 transformations on (down, right) pairs
const D4_TRANSFORMS = [
    (d, r) => [d, r], // e: identity
    (d, r) => [r, reverse3(d)], // r: 90° CW
    (d, r) => [reverse3(d), reverse3(r)], // r²: 180°
    (d, r) => [reverse3(r), d], // r³: 270° CW
    (d, r) => [reverse3(d), r], // s_h: horizontal reflection
    (d, r) => [d, reverse3(r)], // s_v: vertical reflection
    (d, r) => [r, d], // s_d1: diagonal reflection
    (d, r) => [reverse3(r), reverse3(d)], // s_d2: anti-diagonal reflection
];

const D4_NAMES = [
    "e",
    "r",
    "r\u00B2",
    "r\u00B3",
    "s_h",
    "s_v",
    "s_d1",
    "s_d2",
];

// Unicode subscript digits: ₀₁₂₃₄₅₆₇
const SUB_DIGITS = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087";

function glyphName(prefix, d, r) {
    return prefix + SUB_DIGITS[d] + SUB_DIGITS[r];
}

function pairKey(d, r) {
    return d * 8 + r;
}

function classifyD4() {
    const visited = new Set();
    const classes = [];

    for (let d = 0; d < 8; d++) {
        for (let r = 0; r < 8; r++) {
            if (visited.has(pairKey(d, r))) continue;

            const orbitKeys = new Set();
            const orbit = [];
            const stabilizer = [];
            for (let ti = 0; ti < D4_TRANSFORMS.length; ti++) {
                const [nd, nr] = D4_TRANSFORMS[ti](d, r);
                const key = pairKey(nd, nr);
                if (!orbitKeys.has(key)) {
                    orbitKeys.add(key);
                    orbit.push([nd, nr]);
                }
                visited.add(key);
                if (nd === d && nr === r) {
                    stabilizer.push(D4_NAMES[ti]);
                }
            }

            orbit.sort((a, b) => pairKey(a[0], a[1]) - pairKey(b[0], b[1]));
            const rep = orbit[0];

            classes.push({
                rep,
                orbit,
                stabilizer,
                orbitSize: orbit.length,
            });
        }
    }

    classes.sort(
        (a, b) => pairKey(a.rep[0], a.rep[1]) - pairKey(b.rep[0], b.rep[1]),
    );
    return classes;
}

function stabilizerName(stabilizer) {
    if (stabilizer.length === 8) return "D\u2084";
    if (stabilizer.length === 4) return "D\u2082";
    if (stabilizer.length === 2) {
        if (stabilizer.includes("r\u00B2")) return "Z\u2082-rot";
        if (stabilizer.includes("s_h")) return "Z\u2082-h";
        if (stabilizer.includes("s_v")) return "Z\u2082-v";
        if (stabilizer.includes("s_d1")) return "Z\u2082-d1";
        if (stabilizer.includes("s_d2")) return "Z\u2082-d2";
        return "Z\u2082";
    }
    if (stabilizer.length === 1) return "trivial";
    return "|" + stabilizer.length + "|";
}

function buildEquivalenceClasses(containerId, prefix, verticalWinsTies, classes) {
    const container = document.getElementById(containerId);

    for (const cls of classes) {
        const card = document.createElement("div");
        card.className = "eq-card";

        const canvas = document.createElement("canvas");
        drawGlyph(canvas, cls.rep[0], cls.rep[1], verticalWinsTies);
        card.appendChild(canvas);

        const nameLabel = document.createElement("div");
        nameLabel.className = "sym-name";
        nameLabel.textContent = glyphName(prefix, cls.rep[0], cls.rep[1]);
        card.appendChild(nameLabel);

        const symLabel = document.createElement("div");
        symLabel.className = "label";
        symLabel.textContent =
            stabilizerName(cls.stabilizer) +
            "  |orbit|=" +
            cls.orbitSize;
        card.appendChild(symLabel);

        const members = document.createElement("div");
        members.className = "members";
        members.textContent = cls.orbit
            .map((m) => glyphName(prefix, m[0], m[1]))
            .join(" ");
        card.appendChild(members);

        container.appendChild(card);
    }
}

// ── Init ──
const D4_CLASSES = classifyD4();
buildGrid("v-grid", "V", true);
buildEquivalenceClasses("v-eq-classes", "V", true, D4_CLASSES);
buildGrid("h-grid", "H", false);
buildEquivalenceClasses("h-eq-classes", "H", false, D4_CLASSES);
