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
 * - Optional `include_wt` (default false)
 *
 * Text paste is modal-only (no `list` slash option).
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
        .addBooleanOption((option) =>
            option
                .setName("include_wt")
                .setDescription("Also send Output for WT (default: false)")
                .setRequired(false)
        )
        .toJSON(),
    new ContextMenuCommandBuilder()
        .setName("Format list")
        .setType(ApplicationCommandType.Message)
        .toJSON()
];
