import { formatList, formatWT } from "../formatter.js";

const sample = [
    "Some header junk",
    "PC CARD",
    "cygnar list name",
    "",
    "SPELL Something",
    "10 Warcaster Guy",
    "Heavy Weapon Crate",
    "HEAVY WEAPON - Gun",
    "Heavy Weapon Crate",
    "HEAVY WEAPON - Gun2",
    "Heavy Weapon Crate",
    "HEAVY WEAPON - Gun3",
    "Blocker",
    "Blocker",
    "Blocker",
    "Defenses 2",
    "PC COMMAND CARD",
    "1 Card Name"
].join("\n");

const out = formatList(sample);
const wt = formatWT(sample);

const checks = [
    {
        name: "formatList wraps Discord code fence",
        pass: out.startsWith("```") && out.endsWith("```")
    },
    {
        name: "formatList uppercases first line after PC CARD",
        pass: out.includes("CYGNAR LIST NAME")
    },
    {
        name: "formatList removes SPELL and battlefield objects",
        pass:
            !out.includes("SPELL") &&
            !out.includes("Heavy Weapon Crate") &&
            !out.includes("Blocker")
    },
    {
        name: "formatList keeps defenses / command card markers",
        pass: out.includes("DEFENSES") && out.includes("PC COMMAND CARD")
    },
    {
        name: "formatWT keeps only first 2 of each object type",
        pass:
            (wt.match(/Heavy Weapon Crate/g) || []).length === 2 &&
            (wt.match(/Blocker/g) || []).length === 2 &&
            !wt.includes("HEAVY WEAPON - Gun3")
    }
];

let failed = 0;

for (const check of checks) {
    const mark = check.pass ? "PASS" : "FAIL";
    console.log(`${mark}: ${check.name}`);
    if (!check.pass) {
        failed += 1;
    }
}

if (failed > 0) {
    console.error(`\n${failed} check(s) failed.`);
    console.error("\n--- formatList ---\n" + out);
    console.error("\n--- formatWT ---\n" + wt);
    process.exit(1);
}

console.log("\nAll formatter checks passed.");
