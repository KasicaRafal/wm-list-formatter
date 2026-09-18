const input = document.getElementById("input");

const output = document.getElementById("output");
const outputWT = document.getElementById("outputWT");

const formatBtn = document.getElementById("formatBtn");

const copyBtn = document.getElementById("copyBtn");
const copyWTBtn = document.getElementById("copyWTBtn");

const toast = document.getElementById("toast");


function showToast(message) {

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2000);

}


/*
 * NORMAL OUTPUT
 *
 * This is the original formatter.
 */

function formatList(text) {

    let lines = text.split(/\r?\n/);

    // Remove everything before and including "PC CARD"

    let cutoff = 0;

    for (let i = 0; i < lines.length; i++) {

        const stripped = lines[i].trim();

        if (
            stripped === "PC CARD" ||
            stripped === "PC      CARD"
        ) {

            cutoff = i + 1;

            break;

        }

    }

    lines = lines.slice(cutoff);

    // Remove blank lines

    lines = lines.filter(line =>
        line.trim() !== ""
    );

    // Normalize spaces

    lines = lines.map(line =>
        line.replace(/[ \t]+/g, " ")
    );

    // Remove SPELL lines

    lines = lines.filter(line =>
        !line.trim().startsWith("SPELL")
    );

    // Remove battlefield objects

    const removeWords = [
        "Heavy Weapon Crate",
        "HEAVY WEAPON -",
        "Blocker",
        "Skirmisher",
        "Raider",
        "Ammo Crate",
        "Medical Crate",
        "Mantlet",
        "Fuel Canister"
    ];

    lines = lines.filter(line => {

        const t = line.trim();

        for (const word of removeWords) {

            if (t.includes(word)) {
                return false;
            }

        }

        return true;

    });

    // Replace DEFENSE 1 -

    lines = lines.map(line =>
        line.replace(
            /^\s*DEFENSE\s+1\s*-/,
            " "
        )
    );

    // First "Defenses"

    let defenseDone = false;

    lines = lines.map(line => {

        if (
            !defenseDone &&
            line.trim().startsWith("Defenses")
        ) {

            defenseDone = true;

            return "\nDEFENSES" +
                line.trim().substring("Defenses".length);

        }

        return line;

    });

    // PC COMMAND CARD

    lines = lines.map(line =>
        line.replace(
            /^PC COMMAND CARD/,
            "\nPC COMMAND CARD"
        )
    );

    // Normalize cost lines

    lines = lines.map(line => {

        const match = line.match(/^(\d+)\s+(.*)$/);

        if (match) {
            return `${match[1]} ${match[2]}`;
        }

        return line;

    });

    // Discord formatting

    if (lines.length > 0) {

        lines[0] =
            "```" +
            lines[0].trim().toUpperCase();

        lines[lines.length - 1] += "```";

    }

    return lines.join("\n");

}


/*
 * WT OUTPUT
 *
 * Keeps the ENTIRE original input exactly as-is,
 * except:
 *
 * - only first 2 of each battlefield object type
 *   are kept
 * - Heavy Weapon line belonging to a removed
 *   Heavy Weapon Crate is also removed
 * - blank lines belonging to removed objects
 *   are removed
 *
 * No space normalization.
 * No indentation changes.
 * No Discord formatting.
 */

function formatWT(text) {

    const lines = text.split(/\r?\n/);

    const counts = {};

    const result = [];

    let skipBlankLines = false;
    let removeHeavyWeapon = false;


    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];
        const t = line.trim();


        /*
         * If the previous object was removed,
         * remove all blank lines until the next
         * actual line.
         */

        if (skipBlankLines) {

            if (t === "") {
                continue;
            }

            skipBlankLines = false;

        }


        /*
         * Heavy Weapon Crate
         */

        if (t.includes("Heavy Weapon Crate")) {

            counts["Heavy Weapon Crate"] =
                (counts["Heavy Weapon Crate"] || 0) + 1;


            if (counts["Heavy Weapon Crate"] <= 2) {

                result.push(line);

                removeHeavyWeapon = false;

            }
            else {

                removeHeavyWeapon = true;

                skipBlankLines = true;

            }

            continue;

        }


        /*
         * HEAVY WEAPON belongs to the
         * preceding Heavy Weapon Crate.
         */

        if (t.includes("HEAVY WEAPON -")) {

            if (!removeHeavyWeapon) {
                result.push(line);
            }

            continue;

        }


        /*
         * Identify battlefield object type.
         */

        let objectType = null;


        if (t.includes("Blocker")) {

            objectType = "Blocker";

        }
        else if (t.includes("Skirmisher")) {

            objectType = "Skirmisher";

        }
        else if (t.includes("Raider")) {

            objectType = "Raider";

        }
        else if (t.includes("Ammo Crate")) {

            objectType = "Ammo Crate";

        }
        else if (t.includes("Medical Crate")) {

            objectType = "Medical Crate";

        }
        else if (t.includes("Mantlet")) {

            objectType = "Mantlet";

        }
        else if (t.includes("Fuel Canister")) {

            objectType = "Fuel Canister";

        }


        /*
         * Keep only first 2 of each type.
         */

        if (objectType !== null) {

            counts[objectType] =
                (counts[objectType] || 0) + 1;


            if (counts[objectType] <= 2) {

                result.push(line);

            }
            else {

                skipBlankLines = true;

            }

            continue;

        }


        /*
         * Everything else is copied EXACTLY.
         */

        result.push(line);

    }


    return result.join("\n");

}


/* Format */

formatBtn.addEventListener("click", () => {

    const text = input.value;

    output.value = formatList(text);

    outputWT.value = formatWT(text);

});


/* Copy normal result */

copyBtn.addEventListener("click", async () => {

    try {

        await navigator.clipboard.writeText(
            output.value
        );

        showToast("Copied to clipboard");

    }
    catch (err) {

        console.error(err);

        showToast("Failed to copy");

    }

});


/* Copy WT result */

copyWTBtn.addEventListener("click", async () => {

    try {

        await navigator.clipboard.writeText(
            outputWT.value
        );

        showToast("WT result copied to clipboard");

    }
    catch (err) {

        console.error(err);

        showToast("Failed to copy");

    }

});