// Save the full rendered SVG content (not just the visible pan/zoom window)
// as a standalone .svg file. The diagram lives inside g.viewport, which the
// pan/zoom helper transforms in-place; here we clone the SVG, strip that
// transform, and refit viewBox to the group's bounding box so the file shows
// everything that was actually drawn.

const SVG_NS = "http://www.w3.org/2000/svg";

export function saveSvgFullExtent(svg, group, filename, padding = 16) {
    const bbox = group.getBBox();
    if (!isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width === 0) {
        return;
    }

    const x = bbox.x - padding;
    const y = bbox.y - padding;
    const w = bbox.width + 2 * padding;
    const h = bbox.height + 2 * padding;

    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    clone.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
    clone.setAttribute("width", w);
    clone.setAttribute("height", h);
    clone.removeAttribute("style");

    const cloneGroup = clone.querySelector("g.viewport");
    if (cloneGroup) cloneGroup.removeAttribute("transform");

    // Inline document stylesheets so class-based styling (e.g. .quadrant-bg
    // fills, .matrix-label colors) survives outside the page context. Without
    // this, SVG defaults take over and unfilled classed elements render black.
    const css = collectStylesheets();
    if (css) {
        const styleEl = document.createElementNS(SVG_NS, "style");
        styleEl.textContent = css;
        clone.insertBefore(styleEl, clone.firstChild);
    }

    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], {
        type: "image/svg+xml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function collectStylesheets() {
    const chunks = [];
    for (const sheet of document.styleSheets) {
        let rules;
        try {
            rules = sheet.cssRules;
        } catch {
            // Cross-origin sheet — skip rather than throw.
            continue;
        }
        if (!rules) continue;
        for (const rule of rules) chunks.push(rule.cssText);
    }
    return chunks.join("\n");
}
