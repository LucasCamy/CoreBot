import { PrismaClient, VoiceNotificationConfig } from '@prisma/client';

export interface UpsertVoiceConfigDto {
  guildId: string;
  voiceChannelId: string;
  targetChannelId: string;
  enabled?: boolean;
  joinMessage?: string;
  leaveMessage?: string;
  moveMessage?: string | null;
  mentionUser?: boolean;
  useEmbed?: boolean;
  embedColor?: string | null;
  cooldownSeconds?: number;
}

export class VoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findByChannel(
    guildId: string,
    voiceChannelId: string,
  ): Promise<VoiceNotificationConfig | null> {
    return this.prisma.voiceNotificationConfig.findUnique({
      where: {
        guildId_voiceChannelId: {
          guildId,
          voiceChannelId,
        },
      },
    });
  }

  public async listByGuild(guildId: string): Promise<VoiceNotificationConfig[]> {
    return this.prisma.voiceNotificationConfig.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async upsert(dto: UpsertVoiceConfigDto): Promise<VoiceNotificationConfig> {
    // Ensure guild exists
    await this.prisma.guildConfig.upsert({
      where: { guildId: dto.guildId },
      create: { guildId: dto.guildId },
      update: {},
    });

    return this.prisma.voiceNotificationConfig.upsert({
      where: {
        guildId_voiceChannelId: {
          guildId: dto.guildId,
          voiceChannelId: dto.voiceChannelId,
        },
      },
      create: {
        guildId: dto.guildId,
        voiceChannelId: dto.voiceChannelId,
        targetChannelId: dto.targetChannelId,
        enabled: dto.enabled ?? true,
        joinMessage: dto.joinMessage ?? '👋 {userMention} entrou no canal {channelMention}!',
        leaveMessage: dto.leaveMessage ?? '🚪 {userMention} saiu do canal {channelMention}.',
        moveMessage:
          dto.moveMessage ?? '🔀 {userMention} mudou do canal {channelMention} para outro canal.',
        mentionUser: dto.mentionUser ?? true,
        useEmbed: dto.useEmbed ?? false,
        embedColor: dto.embedColor ?? '#5865F2',
        cooldownSeconds: dto.cooldownSeconds ?? 10,
      },
      update: {
        targetChannelId: dto.targetChannelId,
        enabled: dto.enabled,
        joinMessage: dto.joinMessage,
        leaveMessage: dto.leaveMessage,
        moveMessage: dto.moveMessage,
        mentionUser: dto.mentionUser,
        useEmbed: dto.useEmbed,
        embedColor: dto.embedColor,
        cooldownSeconds: dto.cooldownSeconds,
      },
    });
  }

  public async delete(
    guildId: string,
    voiceChannelId: string,
  ): Promise<VoiceNotificationConfig | null> {
    const existing = await this.findByChannel(guildId, voiceChannelId);
    if (!existing) return null;

    return this.prisma.voiceNotificationConfig.delete({
      where: {
        guildId_voiceChannelId: {
          guildId,
          voiceChannelId,
        },
      },
    });
  }
}
