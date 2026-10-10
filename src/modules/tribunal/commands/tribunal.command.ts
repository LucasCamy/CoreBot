import { SlashCommandBuilder } from 'discord.js';
import { ICommand, CommandContext } from '../../../types/index.js';
import { TribunalService } from '../services/tribunal.service.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { buildTribunalVoteRow } from '../buttons/tribunal-vote.button.js';
import { createTribunalCaseSchema } from '../schemas/tribunal.schema.js';

export const TribunalCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('tribunal')
    .setDescription('Tribunal público do servidor com votações relâmpago e punições estéticas')
    .addSubcommand((sub) =>
      sub
        .setName('julgar')
        .setDescription('Abre um julgamento relâmpago de 10 minutos contra um membro')
        .addUserOption((opt) =>
          opt.setName('usuario').setDescription('Membro a ser julgado').setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('apelido_castigo')
            .setDescription('Apelido humilhante em caso de condenação (1-32 chars)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('motivo')
            .setDescription('Motivo/acusação pelo qual o membro está sendo levado ao tribunal')
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('horas')
            .setDescription('Duração do castigo em horas (ex: 1 a 168 horas)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(168),
        ),
    ),

  async execute(ctx: CommandContext): Promise<void> {
    const sub = ctx.interaction.options.getSubcommand();
    const service = new TribunalService(ctx.container);

    if (sub === 'julgar') {
      const targetUser = ctx.interaction.options.getUser('usuario', true);
      const punishmentNickname = ctx.interaction.options.getString('apelido_castigo', true);
      const reason = ctx.interaction.options.getString('motivo', true);
      const durationHours = ctx.interaction.options.getInteger('horas', true);

      if (targetUser.bot) {
        await ctx.interaction.reply({
          embeds: [BotEmbed.warning('Aviso', 'Bots não respondem ao tribunal dos mortais.')],
          ephemeral: true,
        });
        return;
      }

      if (targetUser.id === ctx.member.id) {
        await ctx.interaction.reply({
          embeds: [BotEmbed.warning('Aviso', 'Você não pode abrir um processo contra si mesmo.')],
          ephemeral: true,
        });
        return;
      }

      const targetMember = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.error(
              'Membro Não Encontrado',
              'O usuário indicado não é membro deste servidor.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      if (ctx.guild.ownerId === targetUser.id) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.error(
              'Imunidade Soberana',
              'O Dono do Servidor possui imunidade soberana e não pode ser levado a julgamento no tribunal!',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      if (!targetMember.manageable) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.error(
              'Hierarquia Superior',
              `Não é possível julgar <@${targetUser.id}>: o membro possui um cargo superior ou igual ao do CoreBot na hierarquia do servidor, impossibilitando a execução de penas.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const validation = createTribunalCaseSchema.safeParse({
        punishmentNickname,
        reason,
        durationHours,
      });

      if (!validation.success) {
        await ctx.interaction.reply({
          embeds: [BotEmbed.error('Dados Inválidos', validation.error.errors[0].message)],
          ephemeral: true,
        });
        return;
      }

      // 10-minute flash vote
      const endsAt = new Date(Date.now() + 10 * 60 * 1000);

      const tribunalCase = await service.createCase({
        guildId: ctx.guildId,
        defendantId: targetUser.id,
        punishmentNickname,
        reason,
        durationHours,
        channelId: ctx.interaction.channelId,
        endsAt,
      });

      const embed = service.buildVotingEmbed(tribunalCase);
      const row = buildTribunalVoteRow(tribunalCase, false);

      const message = await ctx.interaction.reply({
        content: `🚨 **ATENÇÃO JURADOS!** O membro <@${targetUser.id}> foi levado ao banco dos réus!`,
        embeds: [embed],
        components: [row],
        fetchReply: true,
      });

      await service.updateMessageId(tribunalCase.id, message.id);
      return;
    }
  },
};
