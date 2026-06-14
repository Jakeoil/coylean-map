// Orientation triple — three toggle buttons (longitude ↔, latitude ↕, seniority
// ⤢) plus a quadrant label (N/S × E/W; the letter order encodes seniority).
//
// Page-agnostic: it builds the DOM (classes `orient-btns` / `orient-btn` /
// `osym` / `oval` / `orient-label`, styled by the host page) and renders from a
// `getState()` snapshot `{ h, v, seniorityH }`; the host supplies what each
// button does and calls `sync()` after any change.
//
//   const orient = createOrientation(box, {
//     getState: () => ({ h: state.curH, v: state.curV, seniorityH: state.h }),
//     onLong, onLat, onSeniority,    // click handlers — host mutates + re-renders
//   });
//   orient.sync();

// N/S from latitude `v`, E/W from longitude `h`. Under H seniority the letter
// order flips (EW+NS) — that is how the label encodes seniority.
export function quadrantLabel({ h, v, seniorityH }) {
    const ns = v === 1 ? "S" : "N";
    const ew = h === 1 ? "E" : "W";
    return seniorityH ? ew + ns : ns + ew;
}

export function createOrientation(
    container,
    { getState, onLong, onLat, onSeniority },
) {
    container.innerHTML = "";
    const mk = (onClick) => {
        const b = document.createElement("button");
        b.className = "orient-btn";
        b.addEventListener("click", onClick);
        return b;
    };
    const btns = document.createElement("div");
    btns.className = "orient-btns";
    const longBtn = mk(onLong);
    const latBtn = mk(onLat);
    const senBtn = mk(onSeniority);
    btns.append(longBtn, latBtn, senBtn);
    const label = document.createElement("div");
    label.className = "orient-label";
    container.append(btns, label);

    const cell = (sym, val) =>
        `<span class="osym">${sym}</span><span class="oval">${val}</span>`;

    function sync() {
        const s = getState();
        longBtn.innerHTML = cell("↔", s.h);
        latBtn.innerHTML = cell("↕", s.v);
        senBtn.innerHTML = cell("⤢", s.seniorityH ? "H" : "V");
        label.textContent = quadrantLabel(s);
    }

    return { sync };
}
