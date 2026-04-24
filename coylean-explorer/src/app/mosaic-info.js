function valSpan(v) {
    return `<span class="${v ? "val-true" : "val-false"}">${v}</span>`;
}

function summary(quads) {
    const lines = quads
        .map(({ p, name }) =>
            `<div class="row dim">${name.toUpperCase()}: ${p.numRows}×${p.numColumns}` +
            ` &nbsp;h/v=${p.hInitCol}/${p.vInitRow}</div>`,
        )
        .join("");
    return `<div class="title">Universe quadrants</div>${lines}`;
}

// getCtx() returns { quads } — current mosaic state at hover time.
export function makeMosaicInfo(info, getCtx) {
    function showDefault() {
        info.innerHTML = summary(getCtx().quads);
    }

    function showDownInfo(quadName, i, j, val) {
        const q = getCtx().quads.find((qq) => qq.name === quadName);
        if (!q) return;
        const p = q.p;
        info.innerHTML = `
            <div class="title" style="color:#9a4a4a">${quadName.toUpperCase()} · Down r${j}c${i}</div>
            <div class="row">downMatrix[${j}][${i}] = ${valSpan(val)}</div>
            <div class="row dim">quadrant ${p.numRows}×${p.numColumns}, h/v=${p.hInitCol}/${p.vInitRow}</div>
        `;
    }

    function showRightInfo(quadName, i, j, val) {
        const q = getCtx().quads.find((qq) => qq.name === quadName);
        if (!q) return;
        const p = q.p;
        info.innerHTML = `
            <div class="title" style="color:#5a8aaa">${quadName.toUpperCase()} · Right c${i}r${j}</div>
            <div class="row">rightMatrix[${i}][${j}] = ${valSpan(val)}</div>
            <div class="row dim">quadrant ${p.numRows}×${p.numColumns}, h/v=${p.hInitCol}/${p.vInitRow}</div>
        `;
    }

    return {
        onEnterDown: showDownInfo,
        onEnterRight: showRightInfo,
        onLeave: showDefault,
        showDefault,
    };
}
