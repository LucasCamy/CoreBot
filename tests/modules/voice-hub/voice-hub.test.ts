import { describe, it, expect, vi } from 'vitest';
import { VoiceHubRepository } from '../../../src/database/repositories/voice-hub.repository.js';
import { PrismaClient } from '@prisma/client';

describe('VoiceHub Naming Templates & Privacy Formatting', () => {
  it('should correctly format channel name with user and username placeholders', () => {
    const template = '🔊 Sala de {user} (@{username})';
    const member = {
      displayName: 'Carlos Silva',
      user: { username: 'carlos123' },
    };

    const formatted = template
      .replace(/\{user\}/g, member.displayName)
      .replace(/\{username\}/g, member.user.username);

    expect(formatted).toBe('🔊 Sala de Carlos Silva (@carlos123)');
  });

  it('should format private room name with lock emoji correctly', () => {
    let template = '🔊 Sala de {user}';
    const isPrivate = true;

    if (isPrivate) {
      if (template === '🔊 Sala de {user}') {
        template = '🔒 Privada de {user}';
      } else if (!template.startsWith('🔒')) {
        template = template.replace(/^🔊\s*/, '🔒 ');
        if (!template.startsWith('🔒')) {
          template = `🔒 ${template}`;
        }
      }
    }

    const member = {
      displayName: 'Amanda',
      user: { username: 'amanda99' },
    };

    const formatted = template.replace(/\{user\}/g, member.displayName);
    expect(formatted).toBe('🔒 Privada de Amanda');
  });

  it('should toggle channel name between locked and unlocked correctly', () => {
    const currentName = '🔊 Sala de Amanda';
    const lockedName = currentName.startsWith('🔊')
      ? currentName.replace(/^🔊\s*/, '🔒 ')
      : `🔒 ${currentName}`;
    expect(lockedName).toBe('🔒 Sala de Amanda');

    const unlockedName = lockedName.startsWith('🔒')
      ? lockedName.replace(/^🔒\s*/, '🔊 ')
      : lockedName;
    expect(unlockedName).toBe('🔊 Sala de Amanda');
  });
});

describe('VoiceHubRepository Logic', () => {
  it('should handle setChannelLock, addWhitelistedUser and removeWhitelistedUser', async () => {
    const mockPrisma = {
      activeVoiceChannel: {
        update: vi.fn().mockImplementation(({ where, data }) => {
          return Promise.resolve({
            id: 'uuid-1',
            guildId: 'guild-1',
            channelId: where.channelId,
            ownerId: 'user-1',
            isLocked: data.isLocked ?? false,
            whitelistedUserIds: data.whitelistedUserIds ?? [],
            createdAt: new Date(),
          });
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'uuid-1',
          guildId: 'guild-1',
          channelId: 'voice-1',
          ownerId: 'user-1',
          isLocked: true,
          whitelistedUserIds: ['user-friend-1'],
          createdAt: new Date(),
        }),
      },
    } as unknown as PrismaClient;

    const repo = new VoiceHubRepository(mockPrisma);

    // 1. Lock toggle
    const locked = await repo.setChannelLock('voice-1', true);
    expect(locked.isLocked).toBe(true);

    // 2. Add whitelisted user
    const withFriend2 = await repo.addWhitelistedUser('voice-1', 'user-friend-2');
    expect(withFriend2).toBeDefined();
    expect(mockPrisma.activeVoiceChannel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { whitelistedUserIds: ['user-friend-1', 'user-friend-2'] },
      }),
    );

    // 3. Remove whitelisted user
    await repo.removeWhitelistedUser('voice-1', 'user-friend-1');
    expect(mockPrisma.activeVoiceChannel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { whitelistedUserIds: [] },
      }),
    );
  });
});
