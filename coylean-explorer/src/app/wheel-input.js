// Mouse-wheel adjusts a numeric <input> by ±step (×10 with shift).
// Wheel-up = +step, wheel-down = -step. Pass { invert: true } to flip
// (e.g. southExtent: scrolling down increases the southward reach).
export function attachWheelStep(input, { invert = false } = {}) {
    input.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();
            const baseStep = Number(input.step) || 1;
            const step = e.shiftKey ? baseStep * 10 : baseStep;
            const dir = e.deltaY < 0 ? 1 : -1;
            const delta = (invert ? -dir : dir) * step;
            const next = (Number(input.value) || 0) + delta;
            const min = input.min !== "" ? Number(input.min) : -Infinity;
            const max = input.max !== "" ? Number(input.max) : Infinity;
            input.value = String(Math.max(min, Math.min(max, next)));
            input.dispatchEvent(new Event("input", { bubbles: true }));
        },
        { passive: false },
    );
}
