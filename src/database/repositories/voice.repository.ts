import { PrismaClient, VoiceNotificationConfig } from '@prisma/client';

export interface CreateVoiceRuleDto {
  guildId: string;
  voiceChannelId: string;
  targetChannelId: string;
  eventType?: string; // ALL, JOIN, LEAVE, MOVE
  enabled?: boolean;
  joinMessage?: string;
  leaveMessage?: string;
  moveMessage?: string | null;
  mentionUser?: boolean;
  useEmbed?: boolean;
  embedColor?: string | null;
  cooldownSeconds?: number;
}

export interface UpdateVoiceRuleDto {
  targetChannelId?: string;
  eventType?: string;
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
  ): Promise<VoiceNotificationConfig[]> {
    return this.prisma.voiceNotificationConfig.findMany({
      where: {
        guildId,
        voiceChannelId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async findById(id: string): Promise<VoiceNotificationConfig | null> {
    return this.prisma.voiceNotificationConfig.findUnique({
      where: { id },
    });
  }

  public async listByGuild(guildId: string): Promise<VoiceNotificationConfig[]> {
    return this.prisma.voiceNotificationConfig.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async createRule(dto: CreateVoiceRuleDto): Promise<VoiceNotificationConfig> {
    // Ensure guild exists
    await this.prisma.guildConfig.upsert({
      where: { guildId: dto.guildId },
      create: { guildId: dto.guildId },
      update: {},
    });

    return this.prisma.voiceNotificationConfig.create({
      data: {
        guildId: dto.guildId,
        voiceChannelId: dto.voiceChannelId,
        targetChannelId: dto.targetChannelId,
        eventType: dto.eventType ?? 'ALL',
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
    });
  }

  public async updateRule(
    id: string,
    dto: UpdateVoiceRuleDto,
  ): Promise<VoiceNotificationConfig | null> {
    return this.prisma.voiceNotificationConfig.update({
      where: { id },
      data: dto,
    });
  }

  public async deleteRule(id: string, guildId: string): Promise<VoiceNotificationConfig | null> {
    const existing = await this.findById(id);
    if (!existing || existing.guildId !== guildId) return null;

    return this.prisma.voiceNotificationConfig.delete({
      where: { id },
    });
  }

  public async deleteByChannel(guildId: string, voiceChannelId: string): Promise<number> {
    const result = await this.prisma.voiceNotificationConfig.deleteMany({
      where: {
        guildId,
        voiceChannelId,
      },
    });
    return result.count;
  }
}
