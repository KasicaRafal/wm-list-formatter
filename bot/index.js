import "dotenv/config";
import {
    ActionRowBuilder,
    AttachmentBuilder,
    Client,
    Events,
    GatewayIntentBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import { formatList, formatWT } from "../formatter.js";

const DISCORD_MESSAGE_LIMIT = 2000;
const MODAL_ID = "format-list-modal";
const MODAL_FIELD_ID = "list-text";
/** Discord paragraph text-input max length. */
const MODAL_MAX_LENGTH = 4000;

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
 * Message context-menu commands include target message content in the
 * interaction payload without Message Content Intent.
 */
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand() && interaction.commandName === "format") {
            await handleSlashFormat(interaction);
            return;
        }

        if (
            interaction.isModalSubmit() &&
            interaction.customId === MODAL_ID
        ) {
            await handleModalFormat(interaction);
            return;
        }

        if (
            interaction.isMessageContextMenuCommand() &&
            interaction.commandName === "Format list"
        ) {
            await handleContextFormat(interaction);
            return;
        }
    } catch (error) {
        console.error("Error handling interaction:", error);
        await replyError(interaction, error);
    }
});

async function handleSlashFormat(interaction) {
    const pasted = interaction.options.getString("list");
    const attachment = interaction.options.getAttachment("file");

    // No options → open paste modal (helps when users type wrong option names
    // like "lista", or skip options entirely).
    if (!attachment && (pasted === null || pasted.trim() === "")) {
        await interaction.showModal(buildPasteModal());
        return;
    }

    await interaction.deferReply();

    const listText = attachment
        ? await readAttachment(attachment)
        : pasted;

    await replyFormatted(interaction, listText);
}

async function handleModalFormat(interaction) {
    await interaction.deferReply();
    const listText = interaction.fields.getTextInputValue(MODAL_FIELD_ID);
    await replyFormatted(interaction, listText);
}

async function handleContextFormat(interaction) {
    await interaction.deferReply();
    const listText = interaction.targetMessage?.content ?? "";
    await replyFormatted(interaction, listText);
}

function buildPasteModal() {
    const input = new TextInputBuilder()
        .setCustomId(MODAL_FIELD_ID)
        .setLabel("Warmachine list / Lista Warmachine")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(MODAL_MAX_LENGTH)
        .setPlaceholder(
            `Paste list here. Max ${MODAL_MAX_LENGTH} chars — longer lists: /format + file (.txt)`
        );

    return new ModalBuilder()
        .setCustomId(MODAL_ID)
        .setTitle("Format Warmachine list")
        .addComponents(new ActionRowBuilder().addComponents(input));
}

async function replyFormatted(interaction, listText) {
    if (!listText || !listText.trim()) {
        await interaction.editReply({
            content:
                [
                    "No list text found.",
                    "",
                    "**How to use /format**",
                    "• `/format` with no options → paste box opens (best for most lists)",
                    "• Or fill the **`list`** option (exact name: `list`, not `lista`)",
                    "• For very long lists: attach a **`.txt`** via the **`file`** option",
                    "• Or paste the list as a normal message → right‑click → **Apps → Format list**"
                ].join("\n")
        });
        return;
    }

    const output = formatList(listText);
    const outputWT = formatWT(listText);

    await sendLabeledResult(interaction, "Output", output, true);
    await sendLabeledResult(interaction, "Output for WT", outputWT, false);
}

async function readAttachment(attachment) {
    assertTextAttachment(attachment);
    return downloadAttachmentText(attachment);
}

class UserFacingError extends Error {
    constructor(message) {
        super(message);
        this.name = "UserFacingError";
    }
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

async function replyError(interaction, error) {
    const message =
        error instanceof UserFacingError
            ? error.message
            : "Something went wrong while formatting the list.";

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: message, ephemeral: true });
        } else if (interaction.isRepliable()) {
            await interaction.reply({ content: message, ephemeral: true });
        }
    } catch (replyErr) {
        console.error("Failed to send error reply:", replyErr);
    }
}

client.login(token);
