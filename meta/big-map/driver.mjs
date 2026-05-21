// Sweep Propagation build cost across sizes, each run in its own subprocess.
// Stops a mode as soon as it OOMs, crashes, or exceeds the wall-time budget.
//
// Usage: node driver.mjs [maxSize] [heapMb]

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER = join(__dirname, "worker.mjs");

const MAX_SIZE = Number(process.argv[2] ?? 32768);
const HEAP_MB = Number(process.argv[3] ?? 12288);
const WALL_TIMEOUT_MS = 180_000;

const SIZES = [];
for (let n = 8; n <= MAX_SIZE; n *= 2) SIZES.push(n);

const MODES = ["prop", "universe-prop"];

function run(mode, size) {
    return new Promise((resolve) => {
        const start = Date.now();
        const child = spawn(
            process.execPath,
            [`--max-old-space-size=${HEAP_MB}`, WORKER, mode, String(size)],
            { stdio: ["ignore", "pipe", "pipe"] },
        );
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (err += d));
        const timeout = setTimeout(() => {
            child.kill("SIGKILL");
        }, WALL_TIMEOUT_MS);
        child.on("close", (code, signal) => {
            clearTimeout(timeout);
            const wall_ms = Date.now() - start;
            if (code === 0) {
                try {
                    resolve({ ok: true, wall_ms, ...JSON.parse(out.trim()) });
                } catch (e) {
                    resolve({
                        ok: false,
                        wall_ms,
                        reason: "parse-error",
                        out,
                        err: err.trim(),
                    });
                }
            } else {
                resolve({
                    ok: false,
                    wall_ms,
                    code,
                    signal,
                    err: err.trim().slice(0, 600),
                });
            }
        });
    });
}

function fmt(n, w) {
    return String(n).padStart(w);
}

for (const mode of MODES) {
    console.log(`\n=== ${mode} ===`);
    if (mode === "prop") {
        console.log(
            "size      cells          build_ms   rss_mb   heap_mb  wall_ms",
        );
    } else {
        console.log(
            "size  final     cells          uni_ms  bnd_ms  build_ms  uni_rss  rss_mb   heap_mb  wall_ms",
        );
    }
    for (const size of SIZES) {
        const r = await run(mode, size);
        if (!r.ok) {
            const tag = r.signal
                ? `signal=${r.signal}`
                : `code=${r.code}`;
            console.log(
                `${fmt(size, 5)}   FAILED  ${tag}  wall=${r.wall_ms}ms`,
            );
            if (r.err) console.log("   stderr:", r.err);
            break;
        }
        const cells = r.final_rows * r.final_cols;
        if (mode === "prop") {
            console.log(
                [
                    fmt(r.size, 5),
                    fmt(cells.toLocaleString(), 14),
                    fmt(r.build_ms, 10),
                    fmt(r.mem_after.rss, 8),
                    fmt(r.mem_after.heap, 8),
                    fmt(r.wall_ms, 8),
                ].join("  "),
            );
        } else {
            console.log(
                [
                    fmt(r.size, 4),
                    fmt(`${r.final_rows}x${r.final_cols}`, 9),
                    fmt(cells.toLocaleString(), 14),
                    fmt(r.universe_ms, 6),
                    fmt(r.boundary_ms, 6),
                    fmt(r.build_ms, 8),
                    fmt(r.universe_mem.rss, 7),
                    fmt(r.mem_after.rss, 8),
                    fmt(r.mem_after.heap, 8),
                    fmt(r.wall_ms, 7),
                ].join("  "),
            );
        }
    }
}
