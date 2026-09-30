import {
    ApplicationCommandType,
    ContextMenuCommandBuilder,
    SlashCommandBuilder
} from "discord.js";

/**
 * Shared slash / context-menu definitions for the bot and register-commands.js.
 * Discord does not support option-name aliases (e.g. "lista"); keep name `list`.
 */
export const commandDefinitions = [
    new SlashCommandBuilder()
        .setName("format")
        .setDescription(
            "Format a Warmachine list. Run alone to paste, or use list."
        )
        .addStringOption((option) =>
            option
                .setName("list")
                .setDescription(
                    "Paste list here / Wklej listę tutaj (option name: list)"
                )
                .setRequired(false)
                .setMaxLength(6000)
        )
        .addAttachmentOption((option) =>
            option
                .setName("file")
                .setDescription(
                    "Optional .txt if paste too long / Opcj. .txt gdy za długa"
                )
                .setRequired(false)
        )
        .toJSON(),
    new ContextMenuCommandBuilder()
        .setName("Format list")
        .setType(ApplicationCommandType.Message)
        .toJSON()
];
