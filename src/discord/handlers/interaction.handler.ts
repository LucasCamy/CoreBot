import { Interaction, GuildMember } from 'discord.js';
import { CoreBotClient } from '../client.js';
import { GuildGuard } from '../guards/guild.guard.js';
import { PermissionGuard } from '../guards/permission.guard.js';
import { BotEmbed } from '../../utils/embed.builder.js';
import { logger } from '../../utils/logger.js';
import {
  CommandContext,
  ContextMenuContext,
  ButtonContext,
  ModalContext,
  SelectMenuContext,
  AutocompleteContext,
} from '../../types/index.js';
import { eventsProcessedCounter } from '../../utils/metrics.js';

export async function handleInteraction(
  client: CoreBotClient,
  interaction: Interaction,
): Promise<void> {
  // Enforce security: reply and reject any interactions outside allowed guilds
  if (!interaction.guildId || !GuildGuard.isAllowed(interaction.guildId)) {
    if (interaction.isRepliable()) {
      await interaction
        .reply({
          embeds: [
            BotEmbed.error(
              'Servidor Não Autorizado',
              'Este servidor não possui autorização para executar comandos deste bot.',
            ),
          ],
          ephemeral: true,
        })
        .catch(() => null);
    }
    return;
  }

  const container = client.container;
  const guild = interaction.guild;
  let member = interaction.member as GuildMember;

  if (guild && member && !(member instanceof GuildMember)) {
    const fetchedMember = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (fetchedMember) {
      member = fetchedMember;
    }
  }

  if (!guild || !member) {
    if (interaction.isRepliable()) {
      await interaction
        .reply({
          embeds: [
            BotEmbed.error(
              'Erro de Contexto',
              'Não foi possível identificar as informações do servidor ou do membro.',
            ),
          ],
          ephemeral: true,
        })
        .catch(() => null);
    }
    return;
  }

  // Track Prometheus event counter
  eventsProcessedCounter.inc({ event_type: interaction.type.toString() });

  // Handle Autocomplete Interactions
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      const ctx: AutocompleteContext = {
        interaction,
        client,
        container,
        guild,
        member,
        guildId: guild.id,
      };
      await command.autocomplete(ctx);
    } catch (error) {
      logger.error(
        { command: interaction.commandName, error },
        'Error during autocomplete handling',
      );
    }
    return;
  }

  // Handle Slash Commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn({ commandName: interaction.commandName }, 'Command not found in registry');
      return;
    }

    try {
      // Check if guild has bot disabled
      const guildConfig = await container.guildRepository.findByGuildId(guild.id);
      if (guildConfig && !guildConfig.botEnabled && interaction.commandName !== 'bot') {
        await interaction.reply({
          embeds: [
            BotEmbed.warning(
              'Bot Desativado',
              'O CoreBot está atualmente desativado neste servidor por um administrador.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      // Check admin permissions if command requires admin
      if (command.adminOnly) {
        const isAdmin = await PermissionGuard.isAdmin(member, container);
        if (!isAdmin) {
          await interaction.reply({
            embeds: [
              BotEmbed.error(
                'Permissão Negada',
                'Você não tem permissão para executar este comando administrativo.',
              ),
            ],
            ephemeral: true,
          });
          return;
        }
      }

      const ctx: CommandContext = {
        interaction,
        client,
        container,
        guild,
        member,
        guildId: guild.id,
      };

      await command.execute(ctx);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          command: interaction.commandName,
          error: err.message,
          stack: err.stack,
          guildId: guild.id,
        },
        'Error occurred during command execution',
      );

      const errorEmbed = BotEmbed.error(
        'Erro na Execução',
        'Ocorreu um erro ao processar o seu comando. Os administradores foram notificados.',
      );

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
      }
    }
    return;
  }

  // Handle Context Menu Commands (Message / User)
  if (interaction.isContextMenuCommand()) {
    const command = client.contextMenuCommands.get(interaction.commandName);
    if (!command) {
      logger.warn(
        { commandName: interaction.commandName },
        'Context menu command not found in registry',
      );
      return;
    }

    try {
      const guildConfig = await container.guildRepository.findByGuildId(guild.id);
      if (guildConfig && !guildConfig.botEnabled) {
        await interaction.reply({
          embeds: [
            BotEmbed.warning(
              'Bot Desativado',
              'O CoreBot está atualmente desativado neste servidor por um administrador.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      if (command.adminOnly) {
        const isAdmin = await PermissionGuard.isAdmin(member, container);
        if (!isAdmin) {
          await interaction.reply({
            embeds: [
              BotEmbed.error(
                'Permissão Negada',
                'Você não tem permissão para executar este comando administrativo.',
              ),
            ],
            ephemeral: true,
          });
          return;
        }
      }

      const ctx: ContextMenuContext = {
        interaction,
        client,
        container,
        guild,
        member,
        guildId: guild.id,
      };

      await command.execute(ctx);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          contextMenu: interaction.commandName,
          error: err.message,
          stack: err.stack,
          guildId: guild.id,
        },
        'Error occurred during context menu command execution',
      );

      const errorEmbed = BotEmbed.error(
        'Erro na Execução',
        'Ocorreu um erro ao processar o seu comando de contexto.',
      );

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
      }
    }
    return;
  }

  // Handle Button Interactions
  if (interaction.isButton()) {
    const customId = interaction.customId;
    let handler = client.buttonHandlers.get(customId);

    if (!handler) {
      for (const [prefix, h] of client.buttonHandlers.entries()) {
        if (customId.startsWith(prefix)) {
          handler = h;
          break;
        }
      }
    }

    if (!handler) {
      return;
    }

    try {
      const ctx: ButtonContext = {
        interaction,
        client,
        container,
        guild,
        member,
        guildId: guild.id,
      };

      await handler.execute(ctx);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ buttonId: customId, error: err.message }, 'Error during button execution');

      const errorEmbed = BotEmbed.error('Erro', 'Não foi possível concluir a ação do botão.');

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
      }
    }
    return;
  }

  // Handle Modal Submit Interactions
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    let handler = client.modalHandlers.get(customId);

    if (!handler) {
      for (const [prefix, h] of client.modalHandlers.entries()) {
        if (customId.startsWith(prefix)) {
          handler = h;
          break;
        }
      }
    }

    if (!handler) {
      return;
    }

    try {
      const ctx: ModalContext = {
        interaction,
        client,
        container,
        guild,
        member,
        guildId: guild.id,
      };

      await handler.execute(ctx);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ modalId: customId, error: err.message }, 'Error during modal execution');

      const errorEmbed = BotEmbed.error(
        'Erro',
        'Não foi possível processar as informações do modal.',
      );

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
      }
    }
    return;
  }

  // Handle Select Menu Interactions
  if (interaction.isAnySelectMenu()) {
    const customId = interaction.customId;
    let handler = client.selectMenuHandlers.get(customId);

    if (!handler) {
      for (const [prefix, h] of client.selectMenuHandlers.entries()) {
        if (customId.startsWith(prefix)) {
          handler = h;
          break;
        }
      }
    }

    if (!handler) {
      return;
    }

    try {
      const ctx: SelectMenuContext = {
        interaction,
        client,
        container,
        guild,
        member,
        guildId: guild.id,
      };

      await handler.execute(ctx);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        { selectMenuId: customId, error: err.message },
        'Error during select menu execution',
      );

      const errorEmbed = BotEmbed.error('Erro', 'Não foi possível processar a seleção.');

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
      }
    }
    return;
  }
}
