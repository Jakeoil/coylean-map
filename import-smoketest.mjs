// Browser smoke test: proves the `coylean/` import map resolves to /src/ and
// reaches the real engine. Loaded by import-smoketest.html.
// PASS = green page + big "PASS ✓" + tab title "PASS". FAIL = red + reason.
import { Propagation, Universe, Seniority } from "coylean/core";
import * as core from "coylean/core";

const out = document.getElementById("out");

function verdict(pass, detail) {
    document.body.style.background = pass ? "#e7f6e7" : "#fdeaea";
    document.title = (pass ? "PASS" : "FAIL") + " — coylean import test";
    const banner = document.createElement("div");
    banner.textContent = pass ? "PASS ✓" : "FAIL ✗";
    banner.style.cssText =
        "font-size:2.2rem;font-weight:700;margin:0 0 14px;color:" +
        (pass ? "#137333" : "#b00020");
    out.before(banner);
    out.textContent = detail;
}

try {
    const checks = [
        ["coylean/core resolved", true],
        ["Propagation is a fn", typeof Propagation === "function"],
        ["Universe defined", typeof Universe !== "undefined"],
        ["Seniority.vertical() works", !!Seniority.vertical()],
        ["export count > 0", Object.keys(core).length > 0],
    ];
    const pass = checks.every(([, v]) => v === true);
    verdict(
        pass,
        checks.map(([k, v]) => "  " + (v === true ? "✓" : "✗") + " " + k +
            ": " + v).join("\n") +
            "\n\nexports: " + Object.keys(core).join(", "),
    );
} catch (e) {
    // An import-resolution failure throws before this — but if the module
    // loaded and something else broke, show why.
    verdict(false, (e && e.stack) ? e.stack : String(e));
}
