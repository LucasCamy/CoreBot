import { Container } from '../../core/container.js';
import { QUEUE_NAMES } from '../../config/constants.js';
import { QueueManager } from '../queue.js';
import { logger } from '../../utils/logger.js';
import { MatchmakingService } from '../../modules/matchmaking/services/matchmaking.service.js';

export class MatchmakingScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly container: Container) {}

  public async start(): Promise<void> {
    logger.info('Starting Matchmaking Scheduler worker...');

    QueueManager.registerWorker(
      QUEUE_NAMES.MATCHMAKING_REMINDERS,
      async (job) => {
        const { lobbyId } = job.data as { lobbyId: string };
        const service = new MatchmakingService(this.container);
        const lobby = await service.getLobby(lobbyId);
        if (lobby && lobby.status === 'OPEN') {
          await service.triggerLobbyReady(lobby);
        }
      },
      { concurrency: 2 },
    );

    await this.checkDueLobbies();
    // Run every 30 seconds
    this.timer = setInterval(() => {
      this.checkDueLobbies().catch((err) => {
        logger.error({ error: err }, 'Error in MatchmakingScheduler check');
      });
    }, 30 * 1000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkDueLobbies(): Promise<void> {
    const now = new Date();
    const dueLobbies = await this.container.matchmakingRepository.findDueOpenLobbies(now);

    for (const lobby of dueLobbies) {
      const queue = QueueManager.getQueue(QUEUE_NAMES.MATCHMAKING_REMINDERS);
      await queue.add(
        `lobby-ready-${lobby.id}`,
        { lobbyId: lobby.id },
        { jobId: `lobby-ready-${lobby.id}` },
      );
    }
  }
}
