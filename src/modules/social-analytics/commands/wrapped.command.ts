import { SlashCommandBuilder } from 'discord.js';
import { ICommand, CommandContext } from '../../../types/index.js';
import { SocialAnalyticsService } from '../services/social-analytics.service.js';
import { nowInTimezone } from '../../../utils/time.js';

export const WrappedCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('wrapped')
    .setDescription('Exibe o retrospecto (Wrapped) de estatísticas e resenha em call do servidor')
    .addStringOption((opt) =>
      opt
        .setName('periodo')
        .setDescription('Período de análise')
        .addChoices(
          { name: 'Últimos 30 Dias (Padrão)', value: 'last30' },
          { name: 'Mês Anterior Completo', value: 'last_month' },
        )
        .setRequired(false),
    ),

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.interaction.deferReply();

    const period = ctx.interaction.options.getString('periodo', false) || 'last30';
    const service = new SocialAnalyticsService(ctx.container);

    const guildConfig = await ctx.container.guildRepository.findByGuildId(ctx.guildId);
    const tz = guildConfig?.timezone || 'America/Sao_Paulo';
    const now = nowInTimezone(tz);

    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (period === 'last_month') {
      startDate = now.subtract(1, 'month').startOf('month').toDate();
      endDate = now.subtract(1, 'month').endOf('month').toDate();
      periodLabel = now.subtract(1, 'month').format('MMMM [de] YYYY');
    } else {
      startDate = now.subtract(30, 'days').toDate();
      endDate = now.toDate();
      periodLabel = 'Últimos 30 Dias';
    }

    const data = await service.getWrappedData(ctx.guildId, startDate, endDate);
    const embed = service.buildWrappedEmbed(ctx.guild.name, data, periodLabel);

    await ctx.interaction.editReply({ embeds: [embed] });
  },
};
