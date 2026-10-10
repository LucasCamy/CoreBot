import { Queue, Worker, Processor, QueueOptions, WorkerOptions } from 'bullmq';
import { getRedisClient } from './redis.js';
import { logger } from '../utils/logger.js';

export class QueueManager {
  private static queues: Map<string, Queue> = new Map();
  private static workers: Map<string, Worker> = new Map();

  public static getQueue<T = unknown>(name: string, opts?: Partial<QueueOptions>): Queue<T> {
    if (!this.queues.has(name)) {
      const queue = new Queue<T>(name, {
        connection: getRedisClient(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
        ...opts,
      });

      this.queues.set(name, queue);
      logger.info({ queueName: name }, 'BullMQ Queue initialized');
    }

    return this.queues.get(name) as Queue<T>;
  }

  public static getAllQueues(): Queue[] {
    return Array.from(this.queues.values());
  }

  public static registerWorker<T = unknown, R = unknown>(
    name: string,
    processor: Processor<T, R>,
    opts?: Partial<WorkerOptions>,
  ): Worker<T, R> {
    if (this.workers.has(name)) {
      return this.workers.get(name) as Worker<T, R>;
    }

    const worker = new Worker<T, R>(name, processor, {
      connection: getRedisClient(),
      concurrency: 5,
      ...opts,
    });

    worker.on('completed', (job) => {
      logger.debug({ queueName: name, jobId: job.id }, 'Job completed successfully');
    });

    worker.on('failed', (job, err) => {
      logger.error({ queueName: name, jobId: job?.id, error: err.message }, 'Job failed execution');
    });

    this.workers.set(name, worker as Worker);
    logger.info({ workerName: name }, 'BullMQ Worker registered');
    return worker;
  }

  public static async closeWorkers(): Promise<void> {
    const workersList = Array.from(this.workers.values());
    await Promise.all(
      workersList.map(async (worker) => {
        try {
          await worker.close();
        } catch (err) {
          logger.warn({ err }, 'Error closing worker');
        }
      }),
    );
    this.workers.clear();
    logger.info('All BullMQ workers successfully closed');
  }

  public static async closeQueues(): Promise<void> {
    const queuesList = Array.from(this.queues.values());
    await Promise.all(
      queuesList.map(async (queue) => {
        try {
          await queue.close();
        } catch (err) {
          logger.warn({ err }, 'Error closing queue');
        }
      }),
    );
    this.queues.clear();
    logger.info('All BullMQ queues successfully closed');
  }

  public static async closeAll(): Promise<void> {
    await this.closeWorkers();
    await this.closeQueues();
  }
}
