// 3-bit priority CNOT cascade
//
// orderIndex selects one of the 6 priority permutations.
//
// Bits:
// bit 0 = A
// bit 1 = B
// bit 2 = C
//
// Returns transformed 3-bit value.
//
// Priority rule:
// highest priority controls next
// next controls next
//
// Example:
// A > B > C
// B ^= A
// C ^= B
//
// The 6 orders:
//
// 0: A > B > C
// 1: A > C > B
// 2: B > A > C
// 3: B > C > A
// 4: C > A > B
// 5: C > B > A

export function priority3(x, orderIndex) {

    // Extract bits
    let bits = [
        (x >> 0) & 1, // A
        (x >> 1) & 1, // B
        (x >> 2) & 1  // C
    ];

    // Priority permutations
    const perms = [
        [0,1,2], // A>B>C
        [0,2,1], // A>C>B
        [1,0,2], // B>A>C
        [1,2,0], // B>C>A
        [2,0,1], // C>A>B
        [2,1,0]  // C>B>A
    ];

    const p = perms[orderIndex];

    // Cascade CNOTs
    //
    // middle ^= top
    // bottom ^= middle

    bits[p[1]] ^= bits[p[0]];
    bits[p[2]] ^= bits[p[1]];

    // Repack bits
    return (
        (bits[0] << 0) |
        (bits[1] << 1) |
        (bits[2] << 2)
    );

}
