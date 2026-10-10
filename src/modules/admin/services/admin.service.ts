import { ChannelType, Guild, PermissionsBitField } from 'discord.js';
import { Container } from '../../../core/container.js';
import { RedisManager } from '../../../jobs/redis.js';
import { REQUIRED_BOT_CHANNEL_PERMISSIONS } from '../../../config/constants.js';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptimeSeconds: number;
  memoryUsageMb: number;
  database: boolean;
  redis: boolean;
  discordWsPingMs: number;
}

export interface ChannelPermissionCheck {
  channelId: string;
  channelName: string;
  hasAll: boolean;
  missingPermissions: string[];
}

export class AdminService {
  constructor(private readonly container: Container) {}

  public async getHealth(): Promise<HealthCheckResult> {
    let dbOk = false;
    try {
      await this.container.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const redisOk = await RedisManager.ping();
    const wsPing = this.container.client.ws.ping;
    const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!dbOk || !redisOk) {
      status = 'unhealthy';
    } else if (wsPing > 500) {
      status = 'degraded';
    }

    return {
      status,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: memory,
      database: dbOk,
      redis: redisOk,
      discordWsPingMs: wsPing,
    };
  }

  public async auditGuildPermissions(guild: Guild): Promise<ChannelPermissionCheck[]> {
    const results: ChannelPermissionCheck[] = [];
    const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    if (!botMember) return results;

    // Collect all configured channel IDs
    const voiceConfigs = await this.container.voiceRepository.listByGuild(guild.id);
    const agendaEvents = await this.container.agendaRepository.listUpcoming(guild.id, 50);
    const birthdays = await this.container.birthdayRepository.listByGuild(guild.id);

    const channelIdsToCheck = new Set<string>();
    for (const v of voiceConfigs) {
      channelIdsToCheck.add(v.voiceChannelId);
      channelIdsToCheck.add(v.targetChannelId);
    }
    for (const a of agendaEvents) {
      channelIdsToCheck.add(a.reminderChannelId);
    }
    for (const b of birthdays) {
      channelIdsToCheck.add(b.announcementChannelId);
    }

    for (const chId of channelIdsToCheck) {
      const channel = await guild.channels.fetch(chId).catch(() => null);
      if (!channel) continue;

      const perms = channel.permissionsFor(botMember);
      const missing: string[] = [];

      for (const reqPerm of REQUIRED_BOT_CHANNEL_PERMISSIONS) {
        const flag = PermissionsBitField.Flags[reqPerm];
        if (flag && !perms.has(flag)) {
          // If it's a voice channel, skip SendMessages / EmbedLinks requirement
          if (
            channel.type === ChannelType.GuildVoice &&
            (reqPerm === 'SendMessages' || reqPerm === 'EmbedLinks' || reqPerm === 'AttachFiles')
          ) {
            continue;
          }
          missing.push(reqPerm);
        }
      }

      results.push({
        channelId: channel.id,
        channelName: channel.name,
        hasAll: missing.length === 0,
        missingPermissions: missing,
      });
    }

    return results;
  }
}
