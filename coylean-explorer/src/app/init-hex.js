// Hex codec for boolean init arrays.
//
// Display: pad the bit array up to the next multiple of 8, MSB-first per byte,
// render as space-separated 2-char lowercase hex. Length 4 → "f0";
// length 21 (all true) → "ff ff f8". Padding bits are always zero.
//
// Parse: tolerant of whitespace and case; accepts any non-empty hex string,
// including odd nibble counts. Each nibble contributes 4 booleans, so the
// returned length is always a multiple of 4.

export function boolsToHex(bits) {
    if (bits.length === 0) return "";
    const nBytes = Math.ceil(bits.length / 8);
    const bytes = [];
    for (let b = 0; b < nBytes; b++) {
        let v = 0;
        for (let k = 0; k < 8; k++) {
            const idx = b * 8 + k;
            if (idx < bits.length && bits[idx]) v |= 1 << (7 - k);
        }
        bytes.push(v.toString(16).padStart(2, "0"));
    }
    return bytes.join(" ");
}

// Returns { bits: boolean[], length } on success, or null on invalid input.
// length === bits.length === (nibbleCount * 4).
export function hexToBools(str) {
    const cleaned = str.replace(/\s+/g, "").toLowerCase();
    if (cleaned.length === 0) return null;
    if (!/^[0-9a-f]+$/.test(cleaned)) return null;
    const bits = [];
    for (const ch of cleaned) {
        const n = parseInt(ch, 16);
        bits.push(!!(n & 0x8), !!(n & 0x4), !!(n & 0x2), !!(n & 0x1));
    }
    return { bits, length: bits.length };
}
