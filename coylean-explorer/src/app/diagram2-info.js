import { pri, reaction } from "../../coylean-core.js";

function valSpan(v) {
    return `<span class="${v ? "val-true" : "val-false"}">${v}</span>`;
}

// getCtx() returns { config, result } — current propagation state at hover time.
export function makeInfo(info, getCtx) {
    function showDownInfo(i, j, val) {
        const { config } = getCtx();
        const { hInitCol, vInitRow } = config;
        const pI = pri(i + hInitCol);
        const pJ = pri(j + vInitRow);
        info.innerHTML = `
        <div class="title" style="color:#9a4a4a">Down Matrix r${j}c${i}</div>
        <div class="row">downMatrix[${j}][${i}] = ${valSpan(val)}</div>
        <div class="row dim">vertical arrow entering row ${j} at column ${i}</div>
        <div class="row">pri(${i} + ${hInitCol}) = pri(${i + hInitCol}) = ${pI}</div>
        <div class="row">pri(${j} + ${vInitRow}) = pri(${j + vInitRow}) = ${pJ}</div>
        <div class="row dim">${j === 0 ? "(init row — always true)" : ""}</div>
    `;
    }

    function showRightInfo(i, j, val) {
        const { config } = getCtx();
        const { hInitCol, vInitRow } = config;
        const pI = pri(i + hInitCol);
        const pJ = pri(j + vInitRow);
        info.innerHTML = `
        <div class="title" style="color:#5a8aaa">Right Matrix c${i}r${j}</div>
        <div class="row">rightMatrix[${i}][${j}] = ${valSpan(val)}</div>
        <div class="row dim">horizontal arrow entering column ${i} at row ${j}</div>
        <div class="row">pri(${i} + ${hInitCol}) = pri(${i + hInitCol}) = ${pI}</div>
        <div class="row">pri(${j} + ${vInitRow}) = pri(${j + vInitRow}) = ${pJ}</div>
        <div class="row dim">${i === 0 ? "(init column — always true)" : ""}</div>
    `;
    }

    function showCellInfo(i, j) {
        const { config, result } = getCtx();
        const { hInitCol, vInitRow, seniority } = config;
        const { downMatrix: dm, rightMatrix: rm } = result;
        const dIn = dm[j][i];
        const rIn = rm[i][j];
        const [dOut, rOut] = reaction(
            dIn,
            rIn,
            i,
            j,
            hInitCol,
            vInitRow,
            seniority,
        );
        const pI = pri(i + hInitCol);
        const pJ = pri(j + vInitRow);
        const winner = (seniority.isVertical ? pI >= pJ : pI > pJ)
            ? "down wins"
            : "right wins";

        info.innerHTML = `
        <div class="title" style="color:#7c5cb0">Reaction at cell r${j}c${i}</div>
        <div class="row">in:  down=${valSpan(dIn)}  right=${valSpan(rIn)}</div>
        <div class="row">out: down=${valSpan(dOut)}  right=${valSpan(rOut)}</div>
        <div class="row dim" style="margin-top:6px">pri(${i + hInitCol}) = ${pI} ${pI >= pJ ? "≥" : "<"} ${pJ} = pri(${j + vInitRow})  →  ${winner}</div>
        <div class="row">reaction(${dIn}, ${rIn}, ${i}, ${j}, ${hInitCol}, ${vInitRow})</div>
        <div class="row dim">→ [${dOut}, ${rOut}]</div>
    `;
    }

    function clearInfo() {
        info.innerHTML = '<div class="dim">Hover a diamond</div>';
    }

    return {
        onEnterDown: showDownInfo,
        onEnterRight: showRightInfo,
        onLeave: clearInfo,
        showCellInfo,
    };
}
