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


function formatList(text, discordFormatting = true) {

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
    lines = lines.filter(line => line.trim() !== "");

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
    if (discordFormatting && lines.length > 0) {

        lines[0] =
            "```" +
            lines[0].trim().toUpperCase();

        lines[lines.length - 1] += "```";

    }

    return lines.join("\n");

}


/* Format */

formatBtn.addEventListener("click", () => {

    const text = input.value;

    // Normal output - Discord formatting
    output.value = formatList(text, true);

    // WT output - no Discord backticks
    outputWT.value = formatList(text, false);

});


/* Copy normal result */

copyBtn.addEventListener("click", async () => {

    try {

        await navigator.clipboard.writeText(output.value);

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

        await navigator.clipboard.writeText(outputWT.value);

        showToast("WT result copied to clipboard");

    }
    catch (err) {

        console.error(err);

        showToast("Failed to copy");

    }

});