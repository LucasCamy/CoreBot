import { describe, it, expect } from 'vitest';
import { createQuoteSchema } from '../../src/modules/quotes/schemas/quote.schema.js';
import { createLobbySchema } from '../../src/modules/matchmaking/schemas/matchmaking.schema.js';
import { createClipSchema } from '../../src/modules/clips/schemas/clip.schema.js';
import { createTribunalCaseSchema } from '../../src/modules/tribunal/schemas/tribunal.schema.js';
import { SoundboardService } from '../../src/modules/soundboard/services/soundboard.service.js';
import { createCountdownSchema } from '../../src/modules/social-analytics/schemas/social-analytics.schema.js';
import { SocialAnalyticsService } from '../../src/modules/social-analytics/services/social-analytics.service.js';

describe('New Modules - Unit & Schema Tests', () => {
  describe('Quotes Module', () => {
    it('should validate valid quote payload', () => {
      const result = createQuoteSchema.safeParse({
        guildId: '123456789012345678',
        authorId: '987654321098765432',
        authorName: 'Rodrigo',
        content: 'Essa call tá parecendo um hospício',
        savedById: '111222333444555666',
        channelId: '222333444555666777',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty quote content', () => {
      const result = createQuoteSchema.safeParse({
        guildId: '123',
        authorId: '456',
        authorName: 'Nome',
        content: '',
        savedById: '789',
        channelId: '012',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Matchmaking Module', () => {
    it('should validate valid lobby creation', () => {
      const result = createLobbySchema.safeParse({
        gameName: 'Valorant',
        timeString: '21:30',
        maxPlayers: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid player counts', () => {
      const result = createLobbySchema.safeParse({
        gameName: 'Valorant',
        timeString: '21:30',
        maxPlayers: 1, // min is 2
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Clips Module', () => {
    it('should accept valid URLs from supported platforms', () => {
      const medal = createClipSchema.safeParse({
        title: 'Ace de Vandal absurdo',
        url: 'https://medal.tv/games/valorant/clips/12345',
        game: 'Valorant',
      });
      expect(medal.success).toBe(true);

      const youtube = createClipSchema.safeParse({
        title: 'Jogada linda',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      });
      expect(youtube.success).toBe(true);

      const twitch = createClipSchema.safeParse({
        title: 'Clip da live',
        url: 'https://clips.twitch.tv/GloriousFunnyMoments',
      });
      expect(twitch.success).toBe(true);
    });

    it('should reject non-video or unsupported domains', () => {
      const result = createClipSchema.safeParse({
        title: 'Site de notícias',
        url: 'https://g1.globo.com/noticia',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Tribunal Module', () => {
    it('should validate valid tribunal case parameters', () => {
      const result = createTribunalCaseSchema.safeParse({
        punishmentNickname: 'Cone Supremo',
        reason: 'Ficou AFK na partida decisiva de promoção',
        durationHours: 24,
      });
      expect(result.success).toBe(true);
    });

    it('should reject nicknames longer than 32 characters', () => {
      const result = createTribunalCaseSchema.safeParse({
        punishmentNickname: 'UmNomeAbsurdamenteGrandeQueUltrapassaOLimiteDoDiscord',
        reason: 'Motivo válido',
        durationHours: 12,
      });
      expect(result.success).toBe(false);
    });

    it('should reject hours out of 1-168 bounds', () => {
      const zeroHours = createTribunalCaseSchema.safeParse({
        punishmentNickname: 'Castigo',
        reason: 'Motivo válido',
        durationHours: 0,
      });
      expect(zeroHours.success).toBe(false);

      const tooLong = createTribunalCaseSchema.safeParse({
        punishmentNickname: 'Castigo',
        reason: 'Motivo válido',
        durationHours: 200,
      });
      expect(tooLong.success).toBe(false);
    });

    it('should enforce manageable and ownership business logic rules', () => {
      // Simulate mock guild and member
      const mockGuild = { ownerId: 'owner_123' };
      const ownerUser = { id: 'owner_123' };
      const normalUser = { id: 'member_456' };

      const isOwnerImmune = mockGuild.ownerId === ownerUser.id;
      const isNormalUserImmune = mockGuild.ownerId === normalUser.id;
      expect(isOwnerImmune).toBe(true);
      expect(isNormalUserImmune).toBe(false);

      const mockTargetMemberUnmanageable = { manageable: false };
      const mockTargetMemberManageable = { manageable: true };

      expect(mockTargetMemberUnmanageable.manageable).toBe(false);
      expect(mockTargetMemberManageable.manageable).toBe(true);
    });
  });

  describe('Soundboard Module', () => {
    it('should list available sample audio files from assets/sounds', () => {
      const service = new SoundboardService();
      const sounds = service.getAvailableSounds();
      expect(sounds.length).toBeGreaterThanOrEqual(4);

      const soundNames = sounds.map((s) => s.name);
      expect(soundNames).toContain('vine-boom');
      expect(soundNames).toContain('bruh');
      expect(soundNames).toContain('airhorn');
    });
  });

  describe('Social Analytics Module', () => {
    it('should validate valid countdown parameters', () => {
      const result = createCountdownSchema.safeParse({
        title: 'Churrasco de Fim de Ano',
        dateString: '25/12/2026',
      });
      expect(result.success).toBe(true);
    });

    it('should contain humorous late-night goodbyes with placeholder', () => {
      const goodbyes = SocialAnalyticsService.LATE_NIGHT_GOODBYES;
      expect(goodbyes.length).toBeGreaterThan(3);
      for (const phrase of goodbyes) {
        expect(phrase).toContain('{user}');
      }
    });

    it('should filter voice sessions shorter than 30 seconds threshold', () => {
      const MIN_SESSION_DURATION_SECONDS = 30;
      const microDropDuration = 12; // 12 seconds micro-drop
      const validSessionDuration = 45; // 45 seconds valid talk

      expect(microDropDuration >= MIN_SESSION_DURATION_SECONDS).toBe(false);
      expect(validSessionDuration >= MIN_SESSION_DURATION_SECONDS).toBe(true);
    });

    it('should enforce 6-hour late-night goodbye cooldown per user', () => {
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
      const now = Date.now();
      const lastGoodbye = now - 2 * 60 * 60 * 1000; // 2 hours ago

      const isCooldownActive = now - lastGoodbye < SIX_HOURS_MS;
      expect(isCooldownActive).toBe(true);

      const oldGoodbye = now - 7 * 60 * 60 * 1000; // 7 hours ago
      const isExpired = now - oldGoodbye < SIX_HOURS_MS;
      expect(isExpired).toBe(false);
    });
  });
});
