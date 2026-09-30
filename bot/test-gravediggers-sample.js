import { formatList, formatWT } from "../formatter.js";

/**
 * Approximate Cygnar Gravediggers / WTC-style list (multi-line, with PC CARD
 * and battlefield objects) to mirror what users paste into Discord.
 */
const sample = `WTC Cyn's Terrible Revenge Against Strugglers
Cygnar - Gravediggers
Theme: Gravediggers
PC CARD
Captain Cygnar Leader
SPELL Fire
10 Warcaster Example
5 Squad Alpha
Heavy Weapon Crate
HEAVY WEAPON - Rifle
Heavy Weapon Crate
HEAVY WEAPON - Rifle2
Heavy Weapon Crate
HEAVY WEAPON - Rifle3
Blocker
Blocker
Blocker
Ammo Crate
Ammo Crate
Ammo Crate
Defenses 2
PC COMMAND CARD
1 Dig In
1 Old Faithful
`;

const out = formatList(sample);
const wt = formatWT(sample);

const checks = [
    {
        name: "strips preamble before PC CARD and uppercases title line",
        pass: out.includes("CAPTAIN CYGNAR LEADER") && !out.includes("WTC Cyn")
    },
    {
        name: "removes SPELL and battlefield objects from Output",
        pass:
            !out.includes("SPELL") &&
            !out.includes("Heavy Weapon Crate") &&
            !out.includes("Blocker") &&
            !out.includes("Ammo Crate")
    },
    {
        name: "keeps defenses / command cards in Output",
        pass: out.includes("DEFENSES") && out.includes("PC COMMAND CARD")
    },
    {
        name: "WT keeps only first 2 of each object type",
        pass:
            (wt.match(/Heavy Weapon Crate/g) || []).length === 2 &&
            (wt.match(/Blocker/g) || []).length === 2 &&
            (wt.match(/Ammo Crate/g) || []).length === 2 &&
            !wt.includes("HEAVY WEAPON - Rifle3")
    },
    {
        name: "WT preserves original list title line",
        pass: wt.includes("WTC Cyn's Terrible Revenge Against Strugglers")
    }
];

let failed = 0;
for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
    if (!check.pass) failed += 1;
}

if (failed) {
    console.error("\n--- formatList ---\n" + out);
    console.error("\n--- formatWT ---\n" + wt);
    process.exit(1);
}

console.log("\nGravediggers-style sample checks passed.");
