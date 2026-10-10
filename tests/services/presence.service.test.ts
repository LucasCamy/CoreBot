import { describe, it, expect, vi } from 'vitest';
import { PresenceService } from '../../src/discord/presence.service.js';
import { Container } from '../../src/core/container.js';

describe('PresenceService', () => {
  it('should initialize and execute updatePresence without throwing', async () => {
    const mockSetPresence = vi.fn();
    const mockContainer = {
      client: {
        user: {
          setPresence: mockSetPresence,
        },
      },
      prisma: {
        gameLobby: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        streamerConfig: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        tribunalCase: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        quote: {
          count: vi.fn().mockResolvedValue(10),
        },
      },
    } as unknown as Container;

    const presence = new PresenceService(mockContainer);

    await presence.updatePresence();

    expect(mockSetPresence).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'online',
        activities: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
          }),
        ]),
      }),
    );
  });

  it('should start and stop timer safely', () => {
    const mockContainer = {
      client: {
        user: {
          setPresence: vi.fn(),
        },
      },
      prisma: {
        gameLobby: { findFirst: vi.fn().mockResolvedValue(null) },
        streamerConfig: { findFirst: vi.fn().mockResolvedValue(null) },
        tribunalCase: { findFirst: vi.fn().mockResolvedValue(null) },
        quote: { count: vi.fn().mockResolvedValue(0) },
      },
    } as unknown as Container;

    const presence = new PresenceService(mockContainer);
    expect(() => presence.start()).not.toThrow();
    expect(() => presence.stop()).not.toThrow();
  });
});
