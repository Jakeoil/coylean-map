// planet-coyleus — color-research: statistics on a color-assignments scheme.
//
// Pure client-side: fetch a scheme JSON (the 12 D4-orbit glyphs, each 16
// canonical cells), then report the color allotment three ways —
//   1. overall allotment (every color's share of the 12×16 = 192 cells),
//   2. per glyph (which colors each orbit contains),
//   3. per color (which glyphs use it, and how heavily).
// Cell index is row-major over the 4×4 glyph (idx = i*4 + j), matching
// terrain-render. No coylean imports — the scheme JSON is self-describing.

const SCHEMES = [
    { file: "color-assignments-II.json", label: "Themes II" },
    { file: "color-assignments-III.json", label: "Themes III" },
    { file: "color-assignments-IV.json", label: "Themes IV" },
];

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
};

// ── color naming: hex → a human hue-family label (deep/­pale qualifier) ──
function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function hexToHsl(hex) {
    let [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let s = 0,
        h = 0;
    const d = max - min;
    if (d) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
    }
    return [h, s, l];
}
function hueFamily(h) {
    // coarse buckets around the wheel
    if (h < 15 || h >= 345) return "red";
    if (h < 40) return "orange";
    if (h < 65) return "amber";
    if (h < 90) return "olive";
    if (h < 160) return "green";
    if (h < 195) return "teal";
    if (h < 255) return "blue";
    if (h < 290) return "violet";
    if (h < 345) return "magenta";
    return "red";
}
function colorName(hex) {
    const [h, s, l] = hexToHsl(hex);
    if (s < 0.12) {
        if (l > 0.8) return "pale grey";
        if (l < 0.3) return "charcoal";
        return "grey";
    }
    let q = "";
    if (l > 0.82) return "pale " + hueFamily(h);
    if (l > 0.68) q = "light ";
    else if (l < 0.32) q = "deep ";
    return q + hueFamily(h);
}

// ── stats ──
function computeStats(data) {
    const orbits = [];
    const totals = new Map();
    let N = 0;
    for (const [letter, o] of Object.entries(data.orbits || {})) {
        const counts = new Map();
        for (const hex of o.cells) {
            counts.set(hex, (counts.get(hex) || 0) + 1);
            totals.set(hex, (totals.get(hex) || 0) + 1);
            N++;
        }
        orbits.push({
            letter,
            canonicalCode: o.canonicalCode,
            cells: o.cells,
            counts,
        });
    }
    // colors sorted by overall frequency (desc), then hex for stability
    const colors = [...totals.entries()]
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .map(([hex, count]) => ({
            hex,
            count,
            name: colorName(hex),
            pct: (100 * count) / N,
        }));
    // which glyphs use each color, heaviest first
    const usage = new Map();
    for (const c of colors) usage.set(c.hex, []);
    for (const o of orbits) {
        for (const [hex, n] of o.counts)
            usage.get(hex).push({ letter: o.letter, count: n });
    }
    for (const arr of usage.values())
        arr.sort((a, b) => b.count - a.count || (a.letter < b.letter ? -1 : 1));
    return { orbits, colors, usage, N, distinct: colors.length };
}

// ── reusable bits ──
function swatch(hex, px = 14) {
    const s = el("span", "sw");
    s.style.width = s.style.height = px + "px";
    s.style.background = hex;
    s.title = hex;
    return s;
}
// the 4×4 canonical glyph as a small grid of cells
function glyphGrid(cells, cellPx = 16) {
    const g = el("div", "glyph");
    g.style.width = g.style.height = cellPx * 4 + "px";
    for (const hex of cells) {
        const c = el("div", "gc");
        c.style.background = hex || "#23262f";
        c.title = hex || "(empty)";
        g.appendChild(c);
    }
    return g;
}

// ── render ──
function renderSummary(st, schemeName) {
    const box = $("summary");
    box.textContent = "";
    const line = el("div", "sumline");
    line.innerHTML =
        `<b>${schemeName}</b> · ${st.orbits.length} orbits · ` +
        `${st.N} canonical cells · ${st.distinct} distinct colors`;
    box.appendChild(line);

    // one stacked allotment bar — the whole 192-cell budget at a glance
    const bar = el("div", "stackbar");
    for (const c of st.colors) {
        const seg = el("div", "seg");
        seg.style.width = c.pct + "%";
        seg.style.background = c.hex;
        seg.title = `${c.hex} ${c.name} — ${c.count} (${c.pct.toFixed(1)}%)`;
        bar.appendChild(seg);
    }
    box.appendChild(bar);
}

function renderAllotment(st) {
    const box = $("allotment");
    box.textContent = "";
    const max = st.colors[0]?.count || 1;
    for (const c of st.colors) {
        const row = el("div", "arow");
        row.appendChild(swatch(c.hex, 18));
        const hex = el("span", "hex");
        hex.textContent = c.hex;
        row.appendChild(hex);
        const name = el("span", "cname");
        name.textContent = c.name;
        row.appendChild(name);
        const bar = el("div", "abar");
        const fill = el("div", "afill");
        fill.style.width = (100 * c.count) / max + "%";
        fill.style.background = c.hex;
        bar.appendChild(fill);
        row.appendChild(bar);
        const num = el("span", "anum");
        num.textContent = `${c.count} · ${c.pct.toFixed(1)}%`;
        row.appendChild(num);
        box.appendChild(row);
    }
}

function renderGlyphs(st) {
    const box = $("glyphs");
    box.textContent = "";
    for (const o of st.orbits) {
        const card = el("div", "card");
        const head = el("div", "chead");
        const lt = el("span", "letter");
        lt.textContent = o.letter;
        head.appendChild(lt);
        const code = el("span", "code");
        code.textContent = o.canonicalCode;
        head.appendChild(code);
        card.appendChild(head);
        card.appendChild(glyphGrid(o.cells, 18));
        const dn = el("div", "distinct");
        dn.textContent = `${o.counts.size} colors`;
        card.appendChild(dn);
        const list = el("div", "minilist");
        const sorted = [...o.counts.entries()].sort((a, b) => b[1] - a[1]);
        for (const [hex, n] of sorted) {
            const chip = el("span", "chip");
            chip.appendChild(swatch(hex, 11));
            const x = el("span", "x");
            x.textContent = "×" + n;
            chip.appendChild(x);
            chip.title = hex + " " + colorName(hex);
            list.appendChild(chip);
        }
        card.appendChild(list);
        box.appendChild(card);
    }
}

function renderColors(st) {
    const box = $("colors");
    box.textContent = "";
    for (const c of st.colors) {
        const row = el("div", "crow");
        const sw = swatch(c.hex, 40);
        row.appendChild(sw);
        const meta = el("div", "cmeta");
        const top = el("div", "ctop");
        top.innerHTML =
            `<span class="hex">${c.hex}</span>` +
            `<span class="cname">${c.name}</span>` +
            `<span class="anum">${c.count} cells · ${c.pct.toFixed(1)}%</span>`;
        meta.appendChild(top);
        const chips = el("div", "gchips");
        for (const u of st.usage.get(c.hex)) {
            const chip = el("span", "gchip");
            chip.innerHTML =
                `<b>${u.letter}</b><span class="x">×${u.count}</span>`;
            chips.appendChild(chip);
        }
        meta.appendChild(chips);
        row.appendChild(meta);
        box.appendChild(row);
    }
}

// ── load + wire ──
async function load(file) {
    $("status").textContent = "loading " + file + "…";
    try {
        const res = await fetch("./" + file);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const st = computeStats(data);
        const label =
            SCHEMES.find((s) => s.file === file)?.label || data.name || file;
        renderSummary(st, data.name || label);
        renderAllotment(st);
        renderGlyphs(st);
        renderColors(st);
        $("status").textContent = "";
    } catch (err) {
        $("status").textContent = "failed to load " + file + ": " + err.message;
        console.error(err);
    }
}

function init() {
    const sel = $("scheme");
    for (const s of SCHEMES) {
        const opt = el("option");
        opt.value = s.file;
        opt.textContent = s.label;
        sel.appendChild(opt);
    }
    sel.addEventListener("change", () => load(sel.value));
    load(SCHEMES[0].file);
}

init();
