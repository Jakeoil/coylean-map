// Migration step 1 — `coylean/core` entry point.
// For now this re-exports the live engine in its old home so the bare
// specifier resolves while importers are repointed in batches. Once every
// importer uses "coylean/core", the real engine file moves here and this shim
// is deleted (see the migration plan).
export * from "../../coylean-explorer/coylean-core.js";
