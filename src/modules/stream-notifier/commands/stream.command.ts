import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ICommand, CommandContext, AutocompleteContext } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { PermissionGuard } from '../../../discord/guards/permission.guard.js';

export const StreamCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('stream')
    .setDescription('Gerencia e monitora transmissões ao vivo na Twitch')
    .addSubcommand((sub) =>
      sub
        .setName('adicionar')
        .setDescription('Registra um canal da Twitch para receber avisos quando entrar ao vivo')
        .addStringOption((opt) =>
          opt
            .setName('canal_twitch')
            .setDescription('Login/URL do canal na Twitch (ex: alanzoka, gaules)')
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal_discord')
            .setDescription('Canal de texto onde o aviso será publicado')
            .setRequired(true),
        )
        .addUserOption((opt) =>
          opt
            .setName('membro')
            .setDescription('Membro do Discord que faz a transmissão (para menção opcional)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Lista todos os canais da Twitch monitorados neste servidor'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove o monitoramento de um canal da Twitch')
        .addStringOption((opt) =>
          opt
            .setName('canal_twitch')
            .setDescription('Nome do canal a ser removido')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),

  async autocomplete(ctx: AutocompleteContext): Promise<void> {
    const focusedValue = ctx.interaction.options.getFocused().toLowerCase();
    const repo = ctx.container.streamerRepository;
    const streamers = await repo.listByGuild(ctx.guildId);

    const filtered = streamers
      .filter((s) => s.streamerLogin.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    await ctx.interaction.respond(
      filtered.map((s) => ({
        name: `${s.streamerLogin} (${s.isLive ? '🔴 AO VIVO' : '⚪ Offline'})`,
        value: s.streamerLogin,
      })),
    );
  },

  async execute(ctx: CommandContext): Promise<void> {
    const sub = ctx.interaction.options.getSubcommand();
    const repo = ctx.container.streamerRepository;

    // 1. /stream listar
    if (sub === 'listar') {
      const streamers = await repo.listByGuild(ctx.guildId);

      const embed = new EmbedBuilder()
        .setColor(0x9146ff) // Twitch Purple
        .setTitle('📺 Canais da Twitch Monitorados')
        .setFooter({ text: 'CoreBot • Monitoramento Twitch Helix' })
        .setTimestamp();

      if (streamers.length === 0) {
        embed.setDescription(
          '*Nenhum streamer está cadastrado para monitoramento neste servidor.* Use `/stream adicionar` para começar!',
        );
      } else {
        const lines = streamers.map((s) => {
          const status = s.isLive ? '🔴 **AO VIVO**' : '⚪ *Offline*';
          const memberTag = s.discordUserId ? ` • Membro: <@${s.discordUserId}>` : '';
          return `• **[${s.streamerLogin}](https://twitch.tv/${s.streamerLogin})** (${status}) ➔ Canal: <#${s.channelId}>${memberTag}`;
        });

        embed.setDescription(lines.join('\n\n'));
      }

      await ctx.interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // 2. /stream adicionar (Admin only)
    if (sub === 'adicionar') {
      const isAdmin = await PermissionGuard.isAdmin(ctx.member, ctx.container);
      if (!isAdmin) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.error(
              'Permissão Negada',
              'Apenas administradores podem cadastrar canais de streaming.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      let rawLogin = ctx.interaction.options.getString('canal_twitch', true).trim();
      // Clean URL if pasted like https://twitch.tv/channel
      rawLogin = rawLogin.replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/\/$/, '');
      const streamerLogin = rawLogin.toLowerCase();

      // Basic regex validation for Twitch usernames
      if (!/^[a-zA-Z0-9_]{3,25}$/.test(streamerLogin)) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.warning(
              'Nome Inválido',
              'O login do canal da Twitch deve conter entre 3 e 25 caracteres (apenas letras, números e underlines).',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const channel = ctx.interaction.options.getChannel('canal_discord', true);
      const member = ctx.interaction.options.getUser('membro', false);

      const existing = await repo.findByGuildAndLogin(ctx.guildId, streamerLogin);
      if (existing) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.warning(
              'Canal Já Cadastrado',
              `O canal **${streamerLogin}** já está sendo monitorado no canal <#${existing.channelId}>.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await repo.create({
        guildId: ctx.guildId,
        streamerLogin,
        channelId: channel.id,
        discordUserId: member?.id ?? null,
      });

      const memberMention = member ? ` com menção para <@${member.id}>` : '';
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.success(
            'Streamer Adicionado',
            `O canal **[${streamerLogin}](https://twitch.tv/${streamerLogin})** agora está sendo monitorado!\nOs avisos serão enviados em <#${channel.id}>${memberMention}.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // 3. /stream remover (Admin only)
    if (sub === 'remover') {
      const isAdmin = await PermissionGuard.isAdmin(ctx.member, ctx.container);
      if (!isAdmin) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.error(
              'Permissão Negada',
              'Apenas administradores podem remover o monitoramento de streamers.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const streamerLogin = ctx.interaction.options
        .getString('canal_twitch', true)
        .trim()
        .toLowerCase();
      const deleted = await repo.delete(ctx.guildId, streamerLogin);

      if (deleted) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.success(
              'Monitoramento Removido',
              `O canal **${streamerLogin}** não será mais monitorado neste servidor.`,
            ),
          ],
          ephemeral: true,
        });
      } else {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.warning(
              'Não Encontrado',
              `O canal **${streamerLogin}** não foi encontrado na lista deste servidor.`,
            ),
          ],
          ephemeral: true,
        });
      }
    }
  },
};
