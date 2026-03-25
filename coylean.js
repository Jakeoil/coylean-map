// ═══════════════════════════════════════════════════
//  Coylean Map – JS/Canvas port
// ═══════════════════════════════════════════════════

const COMPLEXITY_SIMPLE = 0;
const COMPLEXITY_ELABORATE = 1;

const COLOR_LIST = [
    "#8FBC8F", // DarkSeaGreen
    "#FFEBCD", // BlanchedAlmond
    "#8A2BE2", // BlueViolet
    "#00FFFF", // Cyan
    "#DEB887", // BurlyWood
    "#FAEBD7", // AntiqueWhite
    "#FF7F50", // Coral
    "#F0FFFF", // Azure
    "#FF1493", // DeepPink
    "#8FBC8F", // DarkSeaGreen
    "#FFFACD", // LemonChiffon
    "#FF6347", // Tomato
    "#B22222", // Firebrick
    "#C0C0C0", // Silver
    "#FFDEAD", // NavajoWhite
    "#A52A2A", // Brown
    "#FF00FF", // Fuchsia
    "#40E0D0", // Turquoise
    "#FF00FF", // Magenta
];

// ── State ──
let complexity = COMPLEXITY_SIMPLE;
let scale = 4;
let depth = 9;
let maxPri = 12;

// Pan state
let anchorX = 0,
    anchorY = 0;
let touchStartX = 0,
    touchStartY = 0;
let touchCurrX = 0,
    touchCurrY = 0;
let dragging = false;

// Off-screen bitmap
let offCanvas, offCtx;
let mapWidth, mapHeight;

// ── DOM ──
const menu = document.getElementById("menu");
const dialogOverlay = document.getElementById("dialog-overlay");
const aboutOverlay = document.getElementById("about-overlay");
const mapView = document.getElementById("map-view");
const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");

// ── Menu wiring ──
document.getElementById("btn-new").onclick = () =>
    dialogOverlay.classList.add("visible");
document.getElementById("btn-about").onclick = () =>
    aboutOverlay.classList.add("visible");
document.getElementById("btn-about-close").onclick = () =>
    aboutOverlay.classList.remove("visible");

dialogOverlay.onclick = (e) => {
    if (e.target === dialogOverlay) dialogOverlay.classList.remove("visible");
};
aboutOverlay.onclick = (e) => {
    if (e.target === aboutOverlay) aboutOverlay.classList.remove("visible");
};

document.getElementById("btn-simple").onclick = () =>
    startMap(COMPLEXITY_SIMPLE);
document.getElementById("btn-elaborate").onclick = () =>
    startMap(COMPLEXITY_ELABORATE);
document.getElementById("btn-back").onclick = goBack;

document.getElementById("btn-depth-up").onclick = () => {
    depth++;
    regenerate();
};
document.getElementById("btn-depth-down").onclick = () => {
    if (depth > 0) {
        depth--;
        regenerate();
    }
};
document.getElementById("btn-scale-up").onclick = () => {
    scale++;
    regenerate();
};
document.getElementById("btn-scale-down").onclick = () => {
    if (scale > 1) {
        scale--;
        regenerate();
    }
};

// ── Navigation ──
function startMap(c) {
    complexity = c;
    scale = 4;
    depth = 5;
    anchorX = anchorY = 0;
    touchStartX = touchStartY = touchCurrX = touchCurrY = 0;

    dialogOverlay.classList.remove("visible");
    menu.style.display = "none";
    mapView.classList.add("visible");

    resizeCanvas();
    generateMap();
    updateStats();
    drawView();
}

function goBack() {
    mapView.classList.remove("visible");
    menu.style.display = "flex";
}

// ── Canvas sizing ──
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight - document.getElementById("hud").offsetHeight;
}
window.addEventListener("resize", () => {
    if (mapView.classList.contains("visible")) {
        resizeCanvas();
        drawView();
    }
});

// ── Algorithm ──
function priority(i) {
    for (let j = 0; j < maxPri; j++) {
        if (i % 2 !== 0) return j;
        i = Math.floor(i / 2);
    }
    return maxPri;
}

function computeMaxPri(ds, rs) {
    if (ds < rs) ds = rs;
    for (let i = 0; i < 32; i++) {
        if (ds < 1) return i;
        ds = Math.floor(ds / 2);
    }
    return 32;
}

function generateMap() {
    // Use a large off-screen canvas like the Android bitmap approach
    mapWidth = 2048 + 5;
    mapHeight = 2048 + 5;

    offCanvas = document.createElement("canvas");
    offCanvas.width = mapWidth;
    offCanvas.height = mapHeight;
    offCtx = offCanvas.getContext("2d");

    // White background
    offCtx.fillStyle = "#FFFFFF";
    offCtx.fillRect(0, 0, mapWidth, mapHeight);

    let numOfDowns = Math.floor(mapWidth / scale);
    let numOfRights = Math.floor(mapHeight / scale);

    if (complexity === COMPLEXITY_ELABORATE) {
        numOfDowns = Math.floor(numOfDowns / 2);
        numOfRights = Math.floor(numOfRights / 2);
    }

    if (numOfDowns < 1) numOfDowns = 1;
    if (numOfRights < 1) numOfRights = 1;

    maxPri = computeMaxPri(numOfDowns, numOfRights);

    const downArrows = new Array(numOfDowns).fill(false);
    const rightArrows = new Array(numOfRights).fill(false);
    downArrows[0] = true;

    let y_place = 0;

    for (let y = 0; y < numOfRights; y++) {
        let x_place = 0;
        let y_height = 0;

        for (let x = 0; x < numOfDowns; x++) {
            let down = downArrows[x];
            let right = rightArrows[y];

            const downPri = priority(x);
            const rightPri = priority(y);

            if (downPri >= rightPri) {
                if (down) right = !right;
            } else {
                if (right) down = !down;
            }

            let x_width;

            if (complexity === COMPLEXITY_ELABORATE) {
                x_width = renderComplex(
                    offCtx,
                    x_place,
                    y_place,
                    downArrows[x],
                    downPri,
                    rightArrows[y],
                    rightPri,
                    down,
                    right,
                );
                y_height = scale * rightPri * 2;
            } else {
                const threshold = maxPri - depth - 2;
                renderSimple(
                    offCtx,
                    x_place,
                    y_place,
                    downPri > threshold && downArrows[x],
                    rightPri > threshold && rightArrows[y],
                );
                x_width = scale;
                y_height = scale;
            }

            downArrows[x] = down;
            rightArrows[y] = right;
            x_place += x_width;
        }
        y_place += y_height;
    }
}

function renderSimple(g, x_place, y_place, down, right) {
    const x_r = x_place + scale;
    const y_b = y_place + scale;

    g.strokeStyle = "#000000";
    g.lineWidth = 1;

    if (down) {
        g.beginPath();
        g.moveTo(x_r, y_place);
        g.lineTo(x_r, y_b);
        g.stroke();
    }
    if (right) {
        g.beginPath();
        g.moveTo(x_place, y_b);
        g.lineTo(x_r, y_b);
        g.stroke();
    }
}

function renderComplex(
    g,
    x_place,
    y_place,
    down,
    downPri,
    right,
    rightPri,
    down_out,
    right_out,
) {
    const width = downPri * 2;
    const height = rightPri * 2;
    const x_width = scale * width;
    const y_height = scale * height;

    for (let i = 0; i < maxPri; i++) {
        let work_done = true;

        if (i > maxPri - depth - 2) {
            work_done = false;
            g.fillStyle = COLOR_LIST[i % COLOR_LIST.length];

            const w = width - 2 * i - 1;
            const h = height - 2 * i - 1;

            if (w > 0) {
                if (down) {
                    if (down_out) {
                        g.fillRect(
                            x_place + scale * (i + 1),
                            y_place,
                            scale * w,
                            scale * (rightPri * 2),
                        );
                    } else {
                        g.fillRect(
                            x_place + scale * (i + 1),
                            y_place,
                            scale * w,
                            scale * (rightPri + 1),
                        );
                    }
                }
                if (down_out) {
                    g.fillRect(
                        x_place + scale * (i + 1),
                        y_place + scale * rightPri,
                        scale * w,
                        scale * rightPri,
                    );
                }
                work_done = true;
            }

            if (h > 0) {
                if (right) {
                    if (right_out) {
                        g.fillRect(
                            x_place,
                            y_place + scale * (i + 1),
                            scale * (downPri * 2),
                            scale * h,
                        );
                    }
                    g.fillRect(
                        x_place,
                        y_place + scale * (i + 1),
                        scale * (downPri + 1),
                        scale * h,
                    );
                }
                if (right_out) {
                    g.fillRect(
                        x_place + scale * downPri,
                        y_place + scale * (i + 1),
                        scale * downPri,
                        scale * h,
                    );
                }
                work_done = true;
            }
        }
        if (!work_done) break;
    }

    return x_width;
}

// ── Drawing the viewport ──
function drawView() {
    if (!offCanvas) return;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tx = anchorX + (touchCurrX - touchStartX);
    const ty = anchorY + (touchCurrY - touchStartY);

    ctx.drawImage(offCanvas, tx, ty);
}

function updateStats() {
    document.getElementById("hud-stats").textContent =
        "depth=" + depth + "  scale=" + scale + "  maxPri=" + maxPri;
}

function regenerate() {
    generateMap();
    updateStats();
    drawView();
}

// ── Mouse pan ──
canvas.addEventListener("mousedown", (e) => {
    dragging = true;
    touchStartX = touchCurrX = e.clientX;
    touchStartY = touchCurrY = e.clientY;
});
canvas.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    touchCurrX = e.clientX;
    touchCurrY = e.clientY;
    drawView();
});
canvas.addEventListener("mouseup", (e) => {
    if (!dragging) return;
    dragging = false;
    anchorX += e.clientX - touchStartX;
    anchorY += e.clientY - touchStartY;
    touchStartX = touchCurrX = e.clientX;
    touchStartY = touchCurrY = e.clientY;
    drawView();
});
canvas.addEventListener("mouseleave", (e) => {
    if (!dragging) return;
    dragging = false;
    anchorX += touchCurrX - touchStartX;
    anchorY += touchCurrY - touchStartY;
    touchStartX = touchCurrX = 0;
    touchStartY = touchCurrY = 0;
    drawView();
});

// ── Touch pan (mobile) ──
canvas.addEventListener(
    "touchstart",
    (e) => {
        e.preventDefault();
        const t = e.touches[0];
        dragging = true;
        touchStartX = touchCurrX = t.clientX;
        touchStartY = touchCurrY = t.clientY;
    },
    { passive: false },
);
canvas.addEventListener(
    "touchmove",
    (e) => {
        e.preventDefault();
        if (!dragging) return;
        const t = e.touches[0];
        touchCurrX = t.clientX;
        touchCurrY = t.clientY;
        drawView();
    },
    { passive: false },
);
canvas.addEventListener("touchend", (e) => {
    if (!dragging) return;
    dragging = false;
    anchorX += touchCurrX - touchStartX;
    anchorY += touchCurrY - touchStartY;
    touchStartX = touchCurrX = 0;
    touchStartY = touchCurrY = 0;
    drawView();
});
