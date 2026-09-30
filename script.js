import { formatList, formatWT } from "./formatter.js";

const input = document.getElementById("input");

const output = document.getElementById("output");
const outputWT = document.getElementById("outputWT");

const formatBtn = document.getElementById("formatBtn");
const clearBtn = document.getElementById("clearBtn");

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


/* Format */

formatBtn.addEventListener("click", () => {

    const text = input.value;

    output.value = formatList(text);

    outputWT.value = formatWT(text);

});


/* Clear all fields */

clearBtn.addEventListener("click", () => {

    input.value = "";
    output.value = "";
    outputWT.value = "";

    showToast("All fields cleared");

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
