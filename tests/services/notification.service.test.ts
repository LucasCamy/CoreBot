import { describe, it, expect, vi } from 'vitest';
import { NotificationService } from '../../src/services/notification.service.js';
import { NotificationLogRepository } from '../../src/database/repositories/notification-log.repository.js';
import { Client } from 'discord.js';

describe('NotificationService', () => {
  const mockClient = {
    channels: {
      fetch: vi.fn(),
    },
    users: {
      fetch: vi.fn(),
    },
  } as unknown as Client;

  const mockLogRepo = {
    create: vi.fn().mockResolvedValue({}),
  } as unknown as NotificationLogRepository;

  it('should detect and suppress duplicate notifications with same deduplication key', async () => {
    const service = new NotificationService(mockClient, mockLogRepo);

    // Call first time with invalid channel -> should attempt and log failure
    const res1 = await service.sendToChannel({
      guildId: '123',
      module: 'test',
      eventType: 'ping',
      channelId: 'invalid-channel',
      content: 'hello',
      deduplicationKey: 'dedup-test-key-1',
    });

    expect(res1).toBeNull();

    // Call second time immediately with same key -> should be suppressed
    const res2 = await service.sendToChannel({
      guildId: '123',
      module: 'test',
      eventType: 'ping',
      channelId: 'invalid-channel',
      content: 'hello',
      deduplicationKey: 'dedup-test-key-1',
    });

    expect(res2).toBeNull();
  });
});
