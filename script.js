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

    let lines = text.split(/\r?\n/);

    // Remove everything before and including "PC CARD"
    let cutoff = 0;

    for (let i = 0; i < lines.length; i++) {
        const stripped = lines[i].trim();

        if (stripped === "PC CARD" || stripped === "PC      CARD") {
            cutoff = i + 1;
            break;
        }
    }

    lines = lines.slice(cutoff);

    // Remove blank lines
    lines = lines.filter(line => line.trim() !== "");

    // Normalize spaces
    lines = lines.map(line => line.replace(/[ \t]+/g, " "));

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

    // PC COMMAND CARD
    lines = lines.map(line =>
        line.replace(/^PC COMMAND CARD/, "\nPC COMMAND CARD")
    );

    // Normalize cost lines
    lines = lines.map(line => {

        const match = line.match(/^(\d+)\s+(.*)$/);

        if (match) {
            return `${match[1]} ${match[2]}`;
        }

        return line;

    });

    // Discord code block
    if (lines.length > 0) {
        lines[0] = "```" + lines[0].trim().toUpperCase();
        lines[lines.length - 1] += "```";
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