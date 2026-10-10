import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { TribunalCase } from '@prisma/client';
import { IButtonHandler, ButtonContext } from '../../../types/index.js';
import { TribunalService } from '../services/tribunal.service.js';
import { BotEmbed } from '../../../utils/embed.builder.js';

export function buildTribunalVoteRow(
  c: TribunalCase,
  isFinished = false,
): ActionRowBuilder<ButtonBuilder> {
  const guiltyBtn = new ButtonBuilder()
    .setCustomId(`tribunal:yes:${c.id}`)
    .setLabel(`⚖️ Culpado (${c.votesYes})`)
    .setStyle(ButtonStyle.Danger)
    .setDisabled(isFinished);

  const innocentBtn = new ButtonBuilder()
    .setCustomId(`tribunal:no:${c.id}`)
    .setLabel(`🕊️ Inocente (${c.votesNo})`)
    .setStyle(ButtonStyle.Success)
    .setDisabled(isFinished);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(guiltyBtn, innocentBtn);
}

export const TribunalVoteButtonHandler: IButtonHandler = {
  customIdPrefix: 'tribunal:',

  async execute(ctx: ButtonContext): Promise<void> {
    const parts = ctx.interaction.customId.split(':');
    const action = parts[1];
    const caseId = parts[2];

    const service = new TribunalService(ctx.container);
    const tribunalCase = await service.getCase(caseId);

    if (!tribunalCase) {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.error('Caso Não Encontrado', 'Este processo do tribunal não foi localizado.'),
        ],
        ephemeral: true,
      });
      return;
    }

    if (tribunalCase.status !== 'VOTING') {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.warning('Votação Encerrada', 'Este julgamento já teve seu veredito proclamado!'),
        ],
        ephemeral: true,
      });
      return;
    }

    if (ctx.member.id === tribunalCase.defendantId) {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.warning(
            'Impedimento Legal',
            'O réu não tem direito a voto em seu próprio julgamento!',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const vote = action === 'yes' ? 'YES' : 'NO';
    const { tribunalCase: updated, duplicate } = await service.vote(caseId, ctx.member.id, vote);

    if (duplicate) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.warning('Voto Duplicado', 'Você já votou neste julgamento!')],
        ephemeral: true,
      });
      return;
    }

    const embed = service.buildVotingEmbed(updated);
    const row = buildTribunalVoteRow(updated, false);

    await ctx.interaction.update({
      embeds: [embed],
      components: [row],
    });

    await ctx.interaction.followUp({
      content: `⚖️ Seu voto de **${vote === 'YES' ? 'CULPADO' : 'INOCENTE'}** foi registrado!`,
      ephemeral: true,
    });
  },
};
