import { EmbedBuilder } from 'discord.js';
import { CommunityClip } from '@prisma/client';
import { Container } from '../../../core/container.js';
import { CreateClipDTO } from '../../../database/repositories/clip.repository.js';
import { BOT_COLORS, BOT_EMOJIS } from '../../../config/constants.js';

export class ClipService {
  constructor(private readonly container: Container) {}

  public async saveClip(data: CreateClipDTO): Promise<CommunityClip> {
    return this.container.clipRepository.createClip(data);
  }

  public async getClip(id: string): Promise<CommunityClip | null> {
    return this.container.clipRepository.findClipById(id);
  }

  public async updateMessageId(id: string, messageId: string): Promise<void> {
    await this.container.clipRepository.updateMessageId(id, messageId);
  }

  public async vote(
    clipId: string,
    userId: string,
    voteType: 'UPVOTE' | 'CRINGE',
  ): Promise<{ clip: CommunityClip; action: 'added' | 'removed' | 'changed' }> {
    return this.container.clipRepository.vote(clipId, userId, voteType);
  }

  public async getTopClips(
    guildId: string,
    game?: string | null,
    limit = 5,
  ): Promise<CommunityClip[]> {
    return this.container.clipRepository.findTopClips(guildId, game, limit);
  }

  public async getTopClipOfMonth(
    guildId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CommunityClip | null> {
    return this.container.clipRepository.findTopClipOfMonth(guildId, startDate, endDate);
  }

  public buildClipEmbed(clip: CommunityClip): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(BOT_COLORS.PRIMARY)
      .setTitle(`${BOT_EMOJIS.CLIP} ${clip.title}`)
      .setURL(clip.url)
      .setDescription(
        `🔗 **Link:** [Assistir Clipe](${clip.url})\n` +
          `🎮 **Jogo:** ${clip.game || 'Geral / Não especificado'}\n` +
          `👤 **Enviado por:** <@${clip.submitterId}>\n` +
          `📅 **Data:** <t:${Math.floor(clip.createdAt.getTime() / 1000)}:R>`,
      )
      .addFields(
        { name: '🔥 Mandou bem', value: `\`${clip.upvotes}\` votos`, inline: true },
        { name: '💀 Cringe/Fails', value: `\`${clip.cringes}\` votos`, inline: true },
      )
      .setFooter({ text: `ID: ${clip.id.slice(0, 8)} • CoreBot Clips` });

    return embed;
  }

  public buildTopClipsEmbed(clips: CommunityClip[], gameFilter?: string | null): EmbedBuilder {
    const title = gameFilter
      ? `🏆 Top Clipes do Servidor — Jogo: ${gameFilter}`
      : '🏆 Top Clipes do Servidor';

    const embed = new EmbedBuilder().setColor(BOT_COLORS.WARNING).setTitle(title);

    if (clips.length === 0) {
      embed.setDescription('*Nenhum clipe encontrado para este filtro.*');
      return embed;
    }

    const description = clips
      .map((c, index) => {
        const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] || '🔹';
        const gameText = c.game ? ` *[${c.game}]*` : '';
        return (
          `${medal} **[${c.title}](${c.url})**${gameText}\n` +
          `   • Enviado por: <@${c.submitterId}>\n` +
          `   • Reações: 🔥 \`${c.upvotes}\` | 💀 \`${c.cringes}\`\n`
        );
      })
      .join('\n');

    embed.setDescription(description);
    embed.setFooter({ text: 'Cadastre clipes com /clip salvar e vote nos seus favoritos!' });
    return embed;
  }
}
