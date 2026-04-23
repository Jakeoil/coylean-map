export const S = 96;      // cell spacing
export const D = S / 2;   // diamond half-diagonal — touches neighbors at vertices
export const PAD = 64;    // padding

// Down diamond D[j][i]: top edge of cell (i,j)
//   center: ((i + 0.5) * S, j * S)
// Right diamond R[i][j]: left edge of cell (i,j)
//   center: (i * S, (j + 0.5) * S)
// Cell center (i,j): ((i + 0.5) * S, (j + 0.5) * S)

export function downPos(i, j) {
    return [PAD + (i + 0.5) * S, PAD + j * S];
}
export function rightPos(i, j) {
    return [PAD + i * S, PAD + (j + 0.5) * S];
}
export function cellPos(i, j) {
    return [PAD + (i + 0.5) * S, PAD + (j + 0.5) * S];
}
