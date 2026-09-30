import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commandDefinitions } from "./commands.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
    console.error(
        "Missing DISCORD_TOKEN or CLIENT_ID. Copy bot/.env.example to bot/.env and fill in the values."
    );
    process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

try {
    if (guildId) {
        console.log(`Registering commands for guild ${guildId}…`);
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: commandDefinitions
        });
        console.log(
            "Guild commands registered (appear almost immediately):",
            commandDefinitions.map((c) => c.name).join(", ")
        );
    } else {
        console.log("Registering commands globally…");
        await rest.put(Routes.applicationCommands(clientId), {
            body: commandDefinitions
        });
        console.log(
            "Global commands registered (may take up to ~1 hour to appear everywhere):",
            commandDefinitions.map((c) => c.name).join(", ")
        );
    }
} catch (error) {
    console.error("Failed to register commands:", error);
    process.exit(1);
}
