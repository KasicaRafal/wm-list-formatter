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
            "Format a Warmachine list. Leave options empty to open a paste box."
        )
        .addStringOption((option) =>
            option
                .setName("list")
                .setDescription(
                    "Paste here / Wklej tutaj (name is list, not lista). Long? use file"
                )
                .setRequired(false)
                .setMaxLength(6000)
        )
        .addAttachmentOption((option) =>
            option
                .setName("file")
                .setDescription(
                    "Attach .txt for long lists / Załącz .txt przy długiej liście"
                )
                .setRequired(false)
        )
        .toJSON(),
    new ContextMenuCommandBuilder()
        .setName("Format list")
        .setType(ApplicationCommandType.Message)
        .toJSON()
];
