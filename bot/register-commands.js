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
        // Clear first so Discord clients drop any stale required options
        // (e.g. old `list` / localized "lista" schema).
        console.log(`Clearing guild commands for ${guildId}…`);
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: []
        });

        console.log(`Registering commands for guild ${guildId}…`);
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: commandDefinitions
        });
        console.log(
            "Guild commands registered:",
            commandDefinitions.map((c) => {
                const opts = (c.options || [])
                    .map((o) => `${o.name}(required=${Boolean(o.required)})`)
                    .join(", ");
                return opts ? `${c.name} [${opts}]` : c.name;
            }).join("; ")
        );
    } else {
        console.log("Registering commands globally…");
        await rest.put(Routes.applicationCommands(clientId), {
            body: commandDefinitions
        });
        console.log(
            "Global commands registered (may take up to ~1 hour):",
            commandDefinitions.map((c) => c.name).join(", ")
        );
    }
} catch (error) {
    console.error("Failed to register commands:", error);
    process.exit(1);
}
