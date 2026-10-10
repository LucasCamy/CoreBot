import client, { Registry } from 'prom-client';
import { CoreBotClient } from '../discord/client.js';
import { QueueManager } from '../jobs/queue.js';
import { QUEUE_NAMES } from '../config/constants.js';

export const prometheusRegistry: Registry = new client.Registry();

// Default Node.js metrics (heap, cpu, gc, event loop lag, etc.)
client.collectDefaultMetrics({ register: prometheusRegistry, prefix: 'corebot_' });

export const discordPingGauge = new client.Gauge({
  name: 'corebot_discord_ping_latency_ms',
  help: 'Discord Gateway WebSocket ping latency in milliseconds',
  registers: [prometheusRegistry],
});

export const activeVoiceGauge = new client.Gauge({
  name: 'corebot_discord_active_voice_connections',
  help: 'Count of active dynamic voice channels managed by CoreBot',
  registers: [prometheusRegistry],
});

export const eventsProcessedCounter = new client.Counter({
  name: 'corebot_discord_events_processed_total',
  help: 'Total number of Discord events and interactions processed by CoreBot',
  labelNames: ['event_type'],
  registers: [prometheusRegistry],
});

export const bullmqJobsGauge = new client.Gauge({
  name: 'corebot_bullmq_jobs_count',
  help: 'Count of BullMQ jobs by queue and state',
  labelNames: ['queue', 'state'],
  registers: [prometheusRegistry],
});

/**
 * Updates dynamic gauges before scraping /metrics
 */
export async function updateSystemMetrics(discordClient?: CoreBotClient): Promise<void> {
  if (discordClient && discordClient.ws) {
    const ping = discordClient.ws.ping;
    discordPingGauge.set(ping > 0 ? ping : 0);

    // Active voice channels count in database or cache
    if (discordClient.container) {
      try {
        const count = await discordClient.container.prisma.activeVoiceChannel.count();
        activeVoiceGauge.set(count);
      } catch {
        // Ignore during transient DB disconnects
      }
    }
  }

  // Collect BullMQ queue counts
  const queues = [
    QUEUE_NAMES.AGENDA_REMINDERS,
    QUEUE_NAMES.BIRTHDAY_GREETINGS,
    'game-server-monitor-queue',
  ];

  for (const queueName of queues) {
    try {
      const queue = QueueManager.getQueue(queueName);
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
      bullmqJobsGauge.set({ queue: queueName, state: 'waiting' }, counts.waiting || 0);
      bullmqJobsGauge.set({ queue: queueName, state: 'active' }, counts.active || 0);
      bullmqJobsGauge.set({ queue: queueName, state: 'completed' }, counts.completed || 0);
      bullmqJobsGauge.set({ queue: queueName, state: 'failed' }, counts.failed || 0);
    } catch {
      // Ignore if queue not initialized yet
    }
  }
}
