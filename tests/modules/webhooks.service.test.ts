import { describe, it, expect, vi } from 'vitest';
import { WebhookService } from '../../src/modules/webhooks/services/webhook.service.js';
import { Container } from '../../src/core/container.js';
import { BOT_COLORS } from '../../src/config/constants.js';

describe('WebhookService', () => {
  const mockNotificationService = {
    sendToChannel: vi.fn().mockResolvedValue({ id: 'msg-123' }),
  };

  const mockWebhookRepo = {
    findFirstWithChannels: vi.fn().mockResolvedValue({
      guildId: 'guild-123',
      deployChannelId: 'channel-deploy-123',
      alertsChannelId: 'channel-alerts-123',
    }),
  };

  const container = {
    webhookRepository: mockWebhookRepo,
    notificationService: mockNotificationService,
  } as unknown as Container;

  const service = new WebhookService(container);

  it('should process successful deploy payload and dispatch notification', async () => {
    const res = await service.processDeploy({
      repository: { full_name: 'org/repo-api' },
      ref: 'refs/heads/production',
      head_commit: {
        message: 'fix: database connection pool',
        author: { name: 'DevOps Lead' },
        url: 'https://github.com/org/repo-api/commit/abc',
      },
      status: 'success',
      environment: 'Production',
    });

    expect(res.success).toBe(true);
    expect(mockNotificationService.sendToChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: 'guild-123',
        channelId: 'channel-deploy-123',
        module: 'webhooks',
        eventType: 'deploy_notification',
      }),
    );
  });

  it('should process Uptime Kuma heartbeat alert', async () => {
    const res = await service.processAlert({
      heartbeat: {
        name: 'PostgreSQL Primary Cluster',
        status: 0, // DOWN
        msg: 'Connection timeout after 3000ms',
        time: new Date().toISOString(),
      },
    });

    expect(res.success).toBe(true);
    expect(mockNotificationService.sendToChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'channel-alerts-123',
        eventType: 'alert_notification',
      }),
    );
  });

  it('should process Prometheus alert with proper CRITICAL severity color', async () => {
    const res = await service.processAlert({
      alerts: [
        {
          status: 'firing',
          labels: {
            alertname: 'HighMemoryUsage',
            severity: 'CRITICAL',
            instance: 'node-01',
          },
          annotations: {
            description: 'Memory usage exceeded 95%',
          },
        },
      ],
    });

    expect(res.success).toBe(true);
    const lastCall = mockNotificationService.sendToChannel.mock.calls.at(-1);
    const embed = lastCall[0].embeds[0];
    expect(embed.data.color).toBe(BOT_COLORS.DANGER);
  });
});
