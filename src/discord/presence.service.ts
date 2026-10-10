import { ActivityType } from 'discord.js';
import { Container } from '../core/container.js';
import { logger } from '../utils/logger.js';

export class PresenceService {
  private timer: NodeJS.Timeout | null = null;
  private currentIndex: number = 0;

  constructor(private readonly container: Container) {}

  public start(): void {
    logger.info('Starting Dynamic Rich Presence service...');

    // Run first presence update asynchronously without awaiting
    this.updatePresence().catch((err) => {
      logger.debug({ error: (err as Error).message }, 'Initial presence update skipped');
    });

    // Update presence every 2 minutes
    this.timer = setInterval(
      () => {
        this.updatePresence().catch((err) => {
          logger.debug({ error: (err as Error).message }, 'Presence interval update error');
        });
      },
      2 * 60 * 1000,
    );
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.debug('Presence service stopped');
    }
  }

  /**
   * Evaluates current server state from database and updates client activity.
   * Runs safely in the background with silent error capturing.
   */
  public async updatePresence(): Promise<void> {
    try {
      const client = this.container.client;
      if (!client.user) return;

      const prisma = this.container.prisma;

      // 1. Fetch live activity candidates concurrently
      const [activeLobby, liveStreamer, activeTribunal, quotesCount] = await Promise.all([
        prisma.gameLobby
          .findFirst({
            where: { status: 'OPEN' },
            include: { participants: true },
            orderBy: { createdAt: 'desc' },
          })
          .catch(() => null),
        prisma.streamerConfig
          .findFirst({
            where: { isLive: true },
          })
          .catch(() => null),
        prisma.tribunalCase
          .findFirst({
            where: { status: 'VOTING' },
          })
          .catch(() => null),
        prisma.quote.count().catch(() => 0),
      ]);

      const candidates: string[] = [];

      if (activeLobby) {
        const count = activeLobby.participants.length;
        candidates.push(`🎮 ${count} no lobby de ${activeLobby.gameName}`);
      }

      if (liveStreamer) {
        candidates.push(`🔴 ${liveStreamer.streamerLogin} ao vivo na Twitch!`);
      }

      if (activeTribunal) {
        candidates.push('⚖️ Tribunal em sessão');
      }

      if (quotesCount > 0) {
        candidates.push(`📖 ${quotesCount} pérolas salvas`);
      }

      // Default activity when nothing active or alongside rotation
      candidates.push('🔊 Conectado com a galera');

      // Round-robin selection
      this.currentIndex = this.currentIndex % candidates.length;
      const statusText = candidates[this.currentIndex] ?? '🔊 Conectado com a galera';
      this.currentIndex = (this.currentIndex + 1) % candidates.length;

      client.user.setPresence({
        activities: [
          {
            name: statusText,
            type: ActivityType.Custom,
          },
        ],
        status: 'online',
      });

      logger.debug({ statusText }, 'Dynamic bot presence updated');
    } catch (error) {
      // Catch exceptions silently to ensure zero impact on event loop
      logger.debug(
        { error: error instanceof Error ? error.message : String(error) },
        'Silent exception in updatePresence',
      );
    }
  }
}
