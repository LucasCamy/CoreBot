import { describe, it, expect } from 'vitest';
import { voiceConfigSchema } from '../../src/modules/voice-notifications/schemas/voice.schema.js';
import { createEventSchema } from '../../src/modules/agenda/schemas/agenda.schema.js';
import { createListSchema } from '../../src/modules/attendee-lists/schemas/list.schema.js';
import { setBirthdaySchema } from '../../src/modules/birthdays/schemas/birthday.schema.js';

describe('Zod Module Schemas Validation', () => {
  describe('Voice Notification Schema', () => {
    it('should accept valid voice config input', () => {
      const input = {
        guildId: '123456789',
        voiceChannelId: '987654321',
        targetChannelId: '555555555',
        useEmbed: true,
        embedColor: '#5865F2',
        cooldownSeconds: 15,
      };

      const result = voiceConfigSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mentionUser).toBe(true);
      }
    });

    it('should reject invalid hex color', () => {
      const input = {
        guildId: '123456789',
        voiceChannelId: '987654321',
        targetChannelId: '555555555',
        embedColor: 'invalid-hex',
      };

      const result = voiceConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Agenda Event Schema', () => {
    it('should validate correct date and time formats', () => {
      const input = {
        guildId: '123',
        title: 'Reunião de Equipe',
        dateStr: '25/12/2026',
        timeStr: '14:30',
        reminderChannelId: '456',
        createdByUserId: '789',
      };

      const result = createEventSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject bad date format', () => {
      const input = {
        guildId: '123',
        title: 'Reunião',
        dateStr: '2026-12-25', // wrong format
        timeStr: '14:30',
        reminderChannelId: '456',
        createdByUserId: '789',
      };

      const result = createEventSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Attendee List Schema', () => {
    it('should validate valid list params', () => {
      const input = {
        guildId: '123',
        title: 'Torneio de Truco',
        channelId: '456',
        maxSlots: 16,
        createdByUserId: '789',
      };

      const result = createListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Birthday Schema', () => {
    it('should accept valid birthday input', () => {
      const input = {
        guildId: '123',
        userId: '456',
        dateStr: '12/10/1995',
        announcementChannelId: '789',
      };

      const result = setBirthdaySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
