import { Container } from '../../core/container.js';
import { QUEUE_NAMES } from '../../config/constants.js';
import { QueueManager } from '../queue.js';
import { logger } from '../../utils/logger.js';
import { TribunalService } from '../../modules/tribunal/services/tribunal.service.js';

export class TribunalScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly container: Container) {}

  public async start(): Promise<void> {
    logger.info('Starting Tribunal Scheduler worker...');

    QueueManager.registerWorker(
      QUEUE_NAMES.TRIBUNAL_EXPIRATION,
      async (job) => {
        const { caseId, action } = job.data as {
          caseId: string;
          action: 'finalize_verdict' | 'expire_punishment';
        };

        const service = new TribunalService(this.container);
        if (action === 'finalize_verdict') {
          await service.finalizeVerdict(caseId);
        } else if (action === 'expire_punishment') {
          await service.expirePunishment(caseId);
        }
      },
      { concurrency: 2 },
    );

    await this.checkTribunalCases();
    this.timer = setInterval(() => {
      this.checkTribunalCases().catch((err) => {
        logger.error({ error: err }, 'Error checking tribunal cases in scheduler');
      });
    }, 30 * 1000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkTribunalCases(): Promise<void> {
    const now = new Date();

    // 1. Voting cases due for verdict
    const dueVotingCases = await this.container.tribunalRepository.findVotingCasesDue(now);
    for (const c of dueVotingCases) {
      const queue = QueueManager.getQueue(QUEUE_NAMES.TRIBUNAL_EXPIRATION);
      await queue.add(
        `verdict-${c.id}`,
        { caseId: c.id, action: 'finalize_verdict' },
        { jobId: `verdict-${c.id}` },
      );
    }

    // 2. Punishments due for nickname restoration
    const duePunishments = await this.container.tribunalRepository.findPunishmentsDue(now);
    for (const c of duePunishments) {
      const queue = QueueManager.getQueue(QUEUE_NAMES.TRIBUNAL_EXPIRATION);
      await queue.add(
        `expire-${c.id}`,
        { caseId: c.id, action: 'expire_punishment' },
        { jobId: `expire-${c.id}` },
      );
    }
  }
}
