// Preview the complete generated set as real baby blocks.
import { BabyBlocks } from "../baby-blocks.js";

const blocks = await BabyBlocks.load("../AlphabetBlocks-complete.svg");
const grid = document.getElementById("grid");
const elSize = document.getElementById("size");
const elOutline = document.getElementById("outline");
const elOverride = document.getElementById("override");
const elColor = document.getElementById("color");

function render() {
    grid.innerHTML = "";
    const size = parseInt(elSize.value);
    const outline = elOutline.checked;
    const color = elOverride.checked ? elColor.value : undefined;
    for (const ch of blocks.chars) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.appendChild(blocks.get(ch, { size, outline, color }));
        const lab = document.createElement("div");
        lab.className = "lab";
        lab.textContent = ch === " " ? "space" : ch;
        cell.appendChild(lab);
        grid.appendChild(cell);
    }
}

render();
for (const el of [elSize, elOutline, elOverride, elColor]) {
    el.addEventListener("input", render);
}
