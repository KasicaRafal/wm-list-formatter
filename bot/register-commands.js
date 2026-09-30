import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
    console.error(
        "Missing DISCORD_TOKEN or CLIENT_ID. Copy bot/.env.example to bot/.env and fill in the values."
    );
    process.exit(1);
}

const commands = [
    new SlashCommandBuilder()
        .setName("format")
        .setDescription("Format a Warmachine army list (Output + Output for WT)")
        .addStringOption((option) =>
            option
                .setName("list")
                .setDescription("Paste your list here (use file if it is too long)")
                .setRequired(false)
        )
        .addAttachmentOption((option) =>
            option
                .setName("file")
                .setDescription("Attach a .txt file when the list is too long to paste")
                .setRequired(false)
        )
        .toJSON()
];

const rest = new REST({ version: "10" }).setToken(token);

try {
    if (guildId) {
        console.log(`Registering /format for guild ${guildId}…`);
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: commands
        });
        console.log("Guild slash commands registered (appear almost immediately).");
    } else {
        console.log("Registering /format globally…");
        await rest.put(Routes.applicationCommands(clientId), {
            body: commands
        });
        console.log(
            "Global slash commands registered (may take up to ~1 hour to appear everywhere)."
        );
    }
} catch (error) {
    console.error("Failed to register commands:", error);
    process.exit(1);
}
