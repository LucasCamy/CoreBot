import { EmbedBuilder } from 'discord.js';
import { TribunalCase } from '@prisma/client';
import { Container } from '../../../core/container.js';
import { CreateTribunalCaseDTO } from '../../../database/repositories/tribunal.repository.js';
import { BOT_COLORS, BOT_EMOJIS } from '../../../config/constants.js';
import { logger } from '../../../utils/logger.js';
import { buildTribunalVoteRow } from '../buttons/tribunal-vote.button.js';

export class TribunalService {
  constructor(private readonly container: Container) {}

  public async createCase(data: CreateTribunalCaseDTO): Promise<TribunalCase> {
    return this.container.tribunalRepository.createCase(data);
  }

  public async getCase(id: string): Promise<TribunalCase | null> {
    return this.container.tribunalRepository.findCaseById(id);
  }

  public async updateMessageId(id: string, messageId: string): Promise<void> {
    await this.container.tribunalRepository.updateMessageId(id, messageId);
  }

  public async vote(
    caseId: string,
    userId: string,
    vote: 'YES' | 'NO',
  ): Promise<{ tribunalCase: TribunalCase; duplicate: boolean }> {
    return this.container.tribunalRepository.vote(caseId, userId, vote);
  }

  public buildVotingEmbed(c: TribunalCase): EmbedBuilder {
    const endsTimestamp = Math.floor(c.endsAt.getTime() / 1000);
    const totalVotes = c.votesYes + c.votesNo;

    return new EmbedBuilder()
      .setColor(BOT_COLORS.WARNING)
      .setTitle(`${BOT_EMOJIS.TRIBUNAL} TRIBUNAL DO SERVIDOR EM SESSÃO!`)
      .setDescription(
        `O membro <@${c.defendantId}> foi levado a julgamento público!\n\n` +
          `📜 **Acusação / Motivo:**\n>>> *${c.reason}*\n\n` +
          `🏷️ **Pena Proposta:** Apelido alterado para **\`${c.punishmentNickname}\`** por **${c.durationHours}h**.\n` +
          `⏳ **Encerramento da Votação:** <t:${endsTimestamp}:R>`,
      )
      .addFields(
        { name: '⚖️ Culpado', value: `\`${c.votesYes}\` votos`, inline: true },
        { name: '🕊️ Inocente', value: `\`${c.votesNo}\` votos`, inline: true },
        { name: '📊 Total de Jurados', value: `\`${totalVotes}\` votos`, inline: true },
      )
      .setFooter({ text: `Processo #${c.id.slice(0, 8)} • Votação relâmpago de 10 minutos` });
  }

  public buildVerdictEmbed(c: TribunalCase, hierarchyFallback = false): EmbedBuilder {
    const isGuilty = c.status === 'GUILTY';
    const color = isGuilty ? BOT_COLORS.DANGER : BOT_COLORS.SUCCESS;
    const title = isGuilty ? '🚨 VEREDITO: RÉU CONDENADO!' : '🕊️ VEREDITO: RÉU DECLARADO INOCENTE!';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(
        `O tribunal encerrou a contagem de votos para <@${c.defendantId}>:\n\n` +
          `⚖️ **Culpado:** \`${c.votesYes}\` votos\n` +
          `🕊️ **Inocente:** \`${c.votesNo}\` votos\n\n` +
          (isGuilty
            ? `O réu foi considerado **CULPADO** por maioria de votos e cumprirá a pena de ter o apelido alterado para **\`${c.punishmentNickname}\`** durante **${c.durationHours} horas**!`
            : 'O réu foi **ABSOLVIDO** pela comunidade e está livre de qualquer acusação!') +
          (hierarchyFallback
            ? '\n\n⚠️ *Nota:* O réu possui cargo com hierarquia superior ao CoreBot. O apelido não pôde ser alterado pelo Discord, mas a condenação moral permanece!'
            : ''),
      )
      .setFooter({ text: `Processo #${c.id.slice(0, 8)} • Tribunal do Servidor` });

    return embed;
  }

  public async finalizeVerdict(caseId: string): Promise<void> {
    const c = await this.getCase(caseId);
    if (!c || c.status !== 'VOTING') return;

    logger.info(
      { caseId, votesYes: c.votesYes, votesNo: c.votesNo },
      'Finalizing tribunal verdict',
    );

    const isGuilty = c.votesYes > c.votesNo;
    const guild = await this.container.client.guilds.fetch(c.guildId).catch(() => null);
    let originalNick: string | null = null;
    let hierarchyFallback = false;

    if (guild && isGuilty) {
      const member = await guild.members.fetch(c.defendantId).catch(() => null);
      if (member) {
        originalNick = member.nickname || member.user.displayName;
        try {
          await member.setNickname(
            c.punishmentNickname,
            `Condenado pelo Tribunal do Servidor (#${c.id.slice(0, 8)})`,
          );
        } catch (err) {
          logger.warn(
            { error: err, defendantId: c.defendantId },
            'Failed to change member nickname due to Discord role hierarchy',
          );
          hierarchyFallback = true;
        }
      }
    }

    const punishmentEndsAt = isGuilty
      ? new Date(Date.now() + c.durationHours * 60 * 60 * 1000)
      : null;

    const updated = await this.container.tribunalRepository.updateVerdict(
      c.id,
      isGuilty ? 'GUILTY' : 'INNOCENT',
      originalNick,
      punishmentEndsAt,
    );

    // Edit original message with disabled buttons
    if (guild && c.messageId) {
      const channel = guild.channels.cache.get(c.channelId);
      if (channel && channel.isTextBased()) {
        const message = await channel.messages.fetch(c.messageId).catch(() => null);
        if (message) {
          const row = buildTribunalVoteRow(updated, true);
          const verdictEmbed = this.buildVerdictEmbed(updated, hierarchyFallback);
          await message.edit({ embeds: [verdictEmbed], components: [row] }).catch(() => null);
          await channel.send({
            content: `📢 **O Tribunal proclamou seu veredito no processo de <@${c.defendantId}>!**`,
            embeds: [verdictEmbed],
          });
        }
      }
    }
  }

  public async expirePunishment(caseId: string): Promise<void> {
    const c = await this.getCase(caseId);
    if (!c || c.status !== 'GUILTY') return;

    logger.info({ caseId, defendantId: c.defendantId }, 'Expiring tribunal punishment');

    const guild = await this.container.client.guilds.fetch(c.guildId).catch(() => null);
    if (guild) {
      const member = await guild.members.fetch(c.defendantId).catch(() => null);
      if (member && c.originalNickname) {
        try {
          await member.setNickname(
            c.originalNickname,
            `Pena do Tribunal cumprida (#${c.id.slice(0, 8)})`,
          );
        } catch (err) {
          logger.warn({ error: err }, 'Could not restore original nickname');
        }
      }

      const channel = guild.channels.cache.get(c.channelId);
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(BOT_COLORS.SUCCESS)
          .setTitle('🕊️ PENA CUMPRIDA NO TRIBUNAL!')
          .setDescription(
            `<@${c.defendantId}> cumpriu suas **${c.durationHours}h** de castigo com o apelido **\`${c.punishmentNickname}\`** e teve seu apelido original restaurado! Está em liberdade condicional.`,
          );

        await channel.send({ embeds: [embed] }).catch(() => null);
      }
    }

    await this.container.tribunalRepository.markExpired(c.id);
  }
}
