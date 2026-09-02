const input = document.getElementById("input");
const output = document.getElementById("output");

const formatBtn = document.getElementById("formatBtn");
const copyBtn = document.getElementById("copyBtn");

const toast = document.getElementById("toast");

function showToast(message) {

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2000);

}

function formatList(text) {

    // Split into lines
    let lines = text.split(/\r?\n/);

    // Remove everything before and including "PC CARD"
    let cutoff = 0;

    for (let i = 0; i < lines.length; i++) {

        const stripped = lines[i].trim();

        if (stripped.includes("PC") && stripped.includes("CARD")) {
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
        !/^\s*SPELL/.test(line)
    );

    // Remove crates and battlefield objects
    const removePattern = /^\s*(Heavy Weapon Crate \d+|HEAVY WEAPON -.*|Blocker \d+|Skirmisher \d+|Raider \d+|Ammo Crate \d+|Medical Crate \d+|Mantlet \d+|Fuel Canister \d+)$/;

    lines = lines.filter(line =>
        !removePattern.test(line)
    );

    // Replace DEFENSE 1 -
    lines = lines.map(line =>
        line.replace(/^\s*DEFENSE\s+1\s*-/, " ")
    );

    // First "Defenses"
    let defenseDone = false;

    lines = lines.map(line => {

        if (!defenseDone && /^\s*Defenses/.test(line)) {

            defenseDone = true;

            return line.replace(
                /^\s*Defenses/,
                "\nDEFENSES"
            );

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

    // Normalize point-cost lines
    lines = lines.map(line => {

        const match = line.match(/^(\d+)\s+(.*)$/);

        if (match) {
            return `${match[1]} ${match[2]}`;
        }

        return line;

    });

    // Wrap with Discord code block
    if (lines.length > 0) {

        lines[0] = "```" + lines[0].trim().toUpperCase();

        lines[lines.length - 1] =
            lines[lines.length - 1] + "```";

    }

    return lines.join("\n");

}

formatBtn.addEventListener("click", () => {

    output.value = formatList(input.value);

});

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