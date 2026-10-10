import { EmbedBuilder } from 'discord.js';
import { Countdown } from '@prisma/client';
import { Container } from '../../../core/container.js';
import { BOT_COLORS } from '../../../config/constants.js';
import { parseDateTime, nowInTimezone } from '../../../utils/time.js';

export interface WrappedData {
  topUsers: { userId: string; totalSeconds: number }[];
  peakHour: { hour: number; totalSessions: number } | null;
  topPair: { userA: string; userB: string; count: number } | null;
}

export class SocialAnalyticsService {
  public static readonly LATE_NIGHT_GOODBYES = [
    '😴 **{user}** arriou os pneus e foi nanar!',
    '🛏️ **{user}** foi de base até amanhã!',
    '💤 **{user}** apagou a luz e foi de dormes!',
    '🛌 **{user}** tombou no teclado e foi pro sono dos justos!',
    '🌙 **{user}** assinou o ponto da madruga e foi dormir!',
    '🥱 **{user}** desligou o disjuntor e foi recarregar as energias!',
  ];

  constructor(private readonly container: Container) {}

  public async getWrappedData(
    guildId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<WrappedData> {
    const topUsers = await this.container.socialAnalyticsRepository.getTopVoiceUsers(
      guildId,
      startDate,
      endDate,
      5,
    );

    const peakHour = await this.container.socialAnalyticsRepository.getPeakVoiceHour(
      guildId,
      startDate,
      endDate,
    );

    const topPair = await this.container.socialAnalyticsRepository.getTopVoicePair(
      guildId,
      startDate,
      endDate,
    );

    return { topUsers, peakHour, topPair };
  }

  public buildWrappedEmbed(
    guildName: string,
    data: WrappedData,
    periodLabel: string,
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(BOT_COLORS.PRIMARY)
      .setTitle(`✨ WRAPPED DO SERVIDOR: ${periodLabel}`)
      .setDescription(
        `Aqui está o retrospecto completo de atividade e resenha em call de **${guildName}**!`,
      );

    // 1. Morador do Server / Top Voice
    if (data.topUsers.length > 0) {
      const topUserLines = data.topUsers
        .map((u, i) => {
          const medal = ['👑', '🥈', '🥉', '4️⃣', '5️⃣'][i] || '🔹';
          const hours = (u.totalSeconds / 3600).toFixed(1);
          return `${medal} <@${u.userId}> — **${hours}h** em chamada`;
        })
        .join('\n');

      embed.addFields({
        name: '🎙️ Moradores do Server (Maior tempo em call)',
        value: topUserLines,
        inline: false,
      });
    } else {
      embed.addFields({
        name: '🎙️ Moradores do Server',
        value: '*Nenhum registro de voz suficiente neste período.*',
        inline: false,
      });
    }

    // 2. Horário de Pico
    if (data.peakHour) {
      const startH = data.peakHour.hour.toString().padStart(2, '0');
      const endH = ((data.peakHour.hour + 1) % 24).toString().padStart(2, '0');
      embed.addFields({
        name: '⏰ Horário de Pico da Galera',
        value: `🔥 **${startH}:00 às ${endH}:00** *(total de ${data.peakHour.totalSessions} conexões registradas)*`,
        inline: true,
      });
    } else {
      embed.addFields({
        name: '⏰ Horário de Pico',
        value: '*Dados insuficientes*',
        inline: true,
      });
    }

    // 3. Dupla Inseparável
    if (data.topPair) {
      embed.addFields({
        name: '🤝 Dupla Inseparável',
        value: `💕 <@${data.topPair.userA}> & <@${data.topPair.userB}>\n*(Coincidiram juntos em chamada ${data.topPair.count} vezes)*`,
        inline: true,
      });
    } else {
      embed.addFields({
        name: '🤝 Dupla Inseparável',
        value: '*Nenhuma dupla frequente identificada*',
        inline: true,
      });
    }

    embed.setFooter({ text: 'CoreBot Social Analytics • Registrado em tempo real' });
    return embed;
  }

  // Countdowns
  public async createCountdown(
    guildId: string,
    title: string,
    dateString: string,
    channelId: string,
    timezone: string,
  ): Promise<{ countdown: Countdown; error?: string }> {
    const targetDate = parseDateTime(dateString, timezone);
    if (!targetDate || targetDate.getTime() <= Date.now()) {
      return {
        countdown: null as unknown as Countdown,
        error:
          'Data inválida ou no passado. Informe uma data futura no formato DD/MM/AAAA ou DD/MM/AAAA HH:mm.',
      };
    }

    const countdown = await this.container.socialAnalyticsRepository.createCountdown({
      guildId,
      title,
      targetDate,
      channelId,
    });

    return { countdown };
  }

  public async listCountdowns(guildId: string): Promise<Countdown[]> {
    return this.container.socialAnalyticsRepository.findCountdownsByGuild(guildId);
  }

  public async deleteCountdown(id: string): Promise<void> {
    await this.container.socialAnalyticsRepository.deleteCountdown(id);
  }

  public buildCountdownEmbed(countdowns: Countdown[], timezone: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(BOT_COLORS.INFO)
      .setTitle('⏳ Contagens Regressivas da Galera')
      .setFooter({ text: 'Atualizado diariamente às 09:00 • CoreBot Countdowns' });

    if (countdowns.length === 0) {
      embed.setDescription('*Nenhuma contagem regressiva ativa no momento.*');
      return embed;
    }

    const now = nowInTimezone(timezone);

    const lines = countdowns.map((c) => {
      const targetTime = c.targetDate.getTime();
      const diffMs = targetTime - now.toDate().getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const targetTimestamp = Math.floor(targetTime / 1000);

      let status = '';
      if (diffDays <= 0) {
        status = '🎉 **É HOJE! O DIA CHEGOU!**';
      } else if (diffDays === 1) {
        status = '🔥 **FALTA APENAS 1 DIA! (AMANHÃ!)**';
      } else {
        status = `⏳ Faltam **${diffDays} dias**`;
      }

      return `🎯 **${c.title}**\n${status} — <t:${targetTimestamp}:D> (<t:${targetTimestamp}:R>)\n*(ID: \`${c.id.slice(0, 8)}\`)*\n`;
    });

    embed.setDescription(lines.join('\n'));
    return embed;
  }
}
