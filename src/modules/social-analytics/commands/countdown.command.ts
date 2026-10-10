import { SlashCommandBuilder } from 'discord.js';
import { ICommand, CommandContext } from '../../../types/index.js';
import { SocialAnalyticsService } from '../services/social-analytics.service.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { createCountdownSchema } from '../schemas/social-analytics.schema.js';

export const CountdownCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('countdown')
    .setDescription('Gerencia contagens regressivas para viagens, lançamentos e eventos')
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Cria uma nova contagem regressiva para a galera')
        .addStringOption((opt) =>
          opt
            .setName('nome')
            .setDescription('Título do evento (ex: Viagem pra Ubatuba, GTA 6)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('data')
            .setDescription('Data futura (ex: DD/MM/AAAA ou DD/MM/AAAA HH:mm)')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Lista todas as contagens regressivas ativas no servidor'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove uma contagem regressiva existente')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('ID da contagem regressiva (visível em /countdown listar)')
            .setRequired(true),
        ),
    ),

  async execute(ctx: CommandContext): Promise<void> {
    const sub = ctx.interaction.options.getSubcommand();
    const service = new SocialAnalyticsService(ctx.container);

    const guildConfig = await ctx.container.guildRepository.findByGuildId(ctx.guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';

    if (sub === 'criar') {
      const title = ctx.interaction.options.getString('nome', true);
      const dateStr = ctx.interaction.options.getString('data', true);

      const validation = createCountdownSchema.safeParse({ title, dateString: dateStr });
      if (!validation.success) {
        await ctx.interaction.reply({
          embeds: [BotEmbed.error('Dados Inválidos', validation.error.errors[0].message)],
          ephemeral: true,
        });
        return;
      }

      const result = await service.createCountdown(
        ctx.guildId,
        title,
        dateStr,
        ctx.interaction.channelId,
        tz,
      );

      if (result.error) {
        await ctx.interaction.reply({
          embeds: [BotEmbed.error('Erro na Data', result.error)],
          ephemeral: true,
        });
        return;
      }

      const timestamp = Math.floor(result.countdown.targetDate.getTime() / 1000);
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.success(
            'Contagem Regressiva Criada',
            `🎉 Contagem para **"${title}"** cadastrada!\n` +
              `📅 Alvo: <t:${timestamp}:F> (<t:${timestamp}:R>)\n` +
              `*O CoreBot atualizará o canal diariamente às 09:00.*`,
          ),
        ],
      });
      return;
    }

    if (sub === 'listar') {
      const countdowns = await service.listCountdowns(ctx.guildId);
      const embed = service.buildCountdownEmbed(countdowns, tz);
      await ctx.interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (sub === 'remover') {
      const idPrefix = ctx.interaction.options.getString('id', true).trim();
      const countdowns = await service.listCountdowns(ctx.guildId);
      const target = countdowns.find((c) => c.id.startsWith(idPrefix));

      if (!target) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.error('Não Encontrada', 'Contagem regressiva não encontrada com este ID.'),
          ],
          ephemeral: true,
        });
        return;
      }

      await service.deleteCountdown(target.id);
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.success('Removido', `A contagem para **"${target.title}"** foi excluída.`),
        ],
        ephemeral: true,
      });
      return;
    }
  },
};
