// MIGRATION shim (src layout, phase 2) — the engine now lives at
// src/core/coylean-core.js, imported everywhere as "coylean/core". This
// re-export keeps the old relative path working while importers are repointed
// batch by batch. Delete once `grep -rl coylean-explorer/coylean-core` is empty.
export * from "../src/core/coylean-core.js";
