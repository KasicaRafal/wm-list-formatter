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
import { formatList } from "../formatter.js";

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
    const attachment = interaction.options.getAttachment("file");

    // Default path: no file → open paste modal immediately.
    if (!attachment) {
        await interaction.showModal(buildPasteModal());
        return;
    }

    await interaction.deferReply();
    const listText = await readAttachment(attachment);
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
        .setLabel("Warmachine list")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(MODAL_MAX_LENGTH)
        .setPlaceholder(
            `Paste your list here (max ${MODAL_MAX_LENGTH} chars)`
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
                    "• `/format` → paste box opens (default)",
                    "• Optional: attach a `.txt` with **`file`** if paste is too long",
                    "• Or right-click a message → **Apps → Format list**"
                ].join("\n")
        });
        return;
    }

    await sendResult(interaction, formatList(listText));
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
 * Send the formatted Output. Long content is sent as a .txt attachment.
 */
async function sendResult(interaction, content) {
    const payload = {};

    if (content.length <= DISCORD_MESSAGE_LIMIT) {
        payload.content = content;
    } else {
        const file = new AttachmentBuilder(Buffer.from(content, "utf8"), {
            name: "output.txt"
        });
        payload.content = "_Too long for a Discord message — see attached file._";
        payload.files = [file];
    }

    await interaction.editReply(payload);
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
