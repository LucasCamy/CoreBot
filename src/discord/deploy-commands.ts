import { REST, Routes } from 'discord.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ICommand, IContextMenuCommand } from '../types/index.js';
import { GuildGuard } from './guards/guild.guard.js';

export async function deployCommands(
  commands: ICommand[],
  contextMenuCommands: IContextMenuCommand[] = [],
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(env.BOT_TOKEN);
  const slashData = [
    ...commands.map((cmd) => cmd.data.toJSON()),
    ...contextMenuCommands.map((cmd) => cmd.data.toJSON()),
  ];

  const allowedGuilds = GuildGuard.getAllowedGuildIds();

  logger.info(
    { count: slashData.length, guilds: allowedGuilds },
    'Registering application slash commands for authorized guilds...',
  );

  for (const guildId of allowedGuilds) {
    try {
      await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), {
        body: slashData,
      });
      logger.info(
        { guildId, count: slashData.length },
        `Successfully registered slash commands for guild ${guildId}`,
      );
    } catch (error) {
      logger.error({ guildId, error }, `Failed to register slash commands for guild ${guildId}`);
    }
  }
}
