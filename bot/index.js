import "dotenv/config";
import {
    AttachmentBuilder,
    Client,
    Events,
    GatewayIntentBits
} from "discord.js";
import { formatList, formatWT } from "../formatter.js";

const DISCORD_MESSAGE_LIMIT = 2000;

const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.error(
        "Missing DISCORD_TOKEN. Copy bot/.env.example to bot/.env and fill in the values."
    );
    process.exit(1);
}

/**
 * Slash commands + attachment options do not need Message Content Intent.
 * Guilds is enough for receiving interactions in servers.
 */
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
        return;
    }

    if (interaction.commandName !== "format") {
        return;
    }

    try {
        await interaction.deferReply();

        const listText = await resolveListText(interaction);

        if (!listText || !listText.trim()) {
            await interaction.editReply({
                content:
                    "Provide a list with the `list` option, or attach a `.txt` file with the `file` option."
            });
            return;
        }

        const output = formatList(listText);
        const outputWT = formatWT(listText);

        await sendLabeledResult(interaction, "Output", output, true);
        await sendLabeledResult(interaction, "Output for WT", outputWT, false);
    } catch (error) {
        console.error("Error handling /format:", error);

        const message =
            error instanceof UserFacingError
                ? error.message
                : "Something went wrong while formatting the list.";

        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: message, ephemeral: true });
        } else {
            await interaction.reply({ content: message, ephemeral: true });
        }
    }
});

class UserFacingError extends Error {
    constructor(message) {
        super(message);
        this.name = "UserFacingError";
    }
}

async function resolveListText(interaction) {
    const pasted = interaction.options.getString("list");
    const attachment = interaction.options.getAttachment("file");

    if (attachment) {
        assertTextAttachment(attachment);
        return downloadAttachmentText(attachment);
    }

    return pasted ?? "";
}

function assertTextAttachment(attachment) {
    const name = (attachment.name || "").toLowerCase();
    const contentType = (attachment.contentType || "").toLowerCase();

    const looksLikeText =
        name.endsWith(".txt") ||
        contentType.startsWith("text/") ||
        contentType === "application/octet-stream";

    if (!looksLikeText) {
        throw new UserFacingError(
            "Please attach a `.txt` file (plain text). Other file types are not supported."
        );
    }

    // Discord attachment size cap for bots is generous; keep a sane limit for lists.
    const maxBytes = 512 * 1024;
    if (attachment.size > maxBytes) {
        throw new UserFacingError(
            "That file is too large. Please keep list attachments under 512 KB."
        );
    }
}

async function downloadAttachmentText(attachment) {
    const response = await fetch(attachment.url);

    if (!response.ok) {
        throw new UserFacingError("Could not download the attached file. Try again.");
    }

    return response.text();
}

/**
 * Send one labeled result. Uses the initial reply for the first payload,
 * then follow-ups. Long content is sent as a .txt attachment.
 */
async function sendLabeledResult(interaction, label, content, isFirst) {
    const header = `**${label}**\n`;
    const combined = header + content;
    const payload = {};

    if (combined.length <= DISCORD_MESSAGE_LIMIT) {
        payload.content = combined;
    } else {
        const safeName = label.toLowerCase().replace(/\s+/g, "-");
        const file = new AttachmentBuilder(Buffer.from(content, "utf8"), {
            name: `${safeName}.txt`
        });
        payload.content = `${header}_Too long for a Discord message — see attached file._`;
        payload.files = [file];
    }

    if (isFirst) {
        await interaction.editReply(payload);
    } else {
        await interaction.followUp(payload);
    }
}

client.login(token);
