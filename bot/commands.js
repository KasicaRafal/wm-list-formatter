import {
    ApplicationCommandType,
    ContextMenuCommandBuilder,
    SlashCommandBuilder
} from "discord.js";

/**
 * /format command shape:
 * - No required options
 * - Run alone → bot opens paste modal
 * - Optional `file` for long lists
 * - Reply = main formatted Output only (no WT on Discord)
 */
export const commandDefinitions = [
    new SlashCommandBuilder()
        .setName("format")
        .setDescription("Format a Warmachine list (opens a paste box)")
        .addAttachmentOption((option) =>
            option
                .setName("file")
                .setDescription("Optional .txt attachment if the list is too long to paste")
                .setRequired(false)
        )
        .toJSON(),
    new ContextMenuCommandBuilder()
        .setName("Format list")
        .setType(ApplicationCommandType.Message)
        .toJSON()
];
