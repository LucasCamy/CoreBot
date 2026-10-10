import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { CommunityClip } from '@prisma/client';
import { IButtonHandler, ButtonContext } from '../../../types/index.js';
import { ClipService } from '../services/clip.service.js';
import { BotEmbed } from '../../../utils/embed.builder.js';

export function buildClipVoteRow(clip: CommunityClip): ActionRowBuilder<ButtonBuilder> {
  const upvoteBtn = new ButtonBuilder()
    .setCustomId(`clip:upvote:${clip.id}`)
    .setLabel(`🔥 Mandou bem (${clip.upvotes})`)
    .setStyle(ButtonStyle.Success);

  const cringeBtn = new ButtonBuilder()
    .setCustomId(`clip:cringe:${clip.id}`)
    .setLabel(`💀 Cringe/Fails (${clip.cringes})`)
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(upvoteBtn, cringeBtn);
}

export const ClipVoteButtonHandler: IButtonHandler = {
  customIdPrefix: 'clip:',

  async execute(ctx: ButtonContext): Promise<void> {
    const parts = ctx.interaction.customId.split(':');
    const action = parts[1];
    const clipId = parts[2];

    const service = new ClipService(ctx.container);
    const voteType = action === 'upvote' ? 'UPVOTE' : 'CRINGE';

    try {
      const { clip, action: voteAction } = await service.vote(clipId, ctx.member.id, voteType);
      const embed = service.buildClipEmbed(clip);
      const row = buildClipVoteRow(clip);

      await ctx.interaction.update({
        embeds: [embed],
        components: [row],
      });

      // Send ephemeral feedback
      let feedback = 'Voto computado!';
      if (voteAction === 'removed') feedback = 'Voto removido.';
      else if (voteAction === 'changed') feedback = 'Voto alterado com sucesso!';

      await ctx.interaction.followUp({
        content: `✅ ${feedback}`,
        ephemeral: true,
      });
    } catch {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Erro', 'Não foi possível registrar seu voto neste clipe.')],
        ephemeral: true,
      });
    }
  },
};
