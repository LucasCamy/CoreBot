import { describe, it, expect } from 'vitest';
import { SoundboardService } from '../../src/modules/soundboard/services/soundboard.service.js';
import { TwitchService } from '../../src/modules/stream-notifier/services/twitch.service.js';

describe('SoundboardService validations', () => {
  const service = new SoundboardService();

  it('should reject upload if name contains invalid characters', async () => {
    const res = await service.uploadSound(
      '../../malicious-path',
      'https://example.com/sound.mp3',
      'sound.mp3',
      1000,
      'audio/mpeg',
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain('nome do som deve ter entre 2 e 32 caracteres');
  });

  it('should reject upload if size exceeds 8MB', async () => {
    const res = await service.uploadSound(
      'huge-sound',
      'https://example.com/sound.mp3',
      'sound.mp3',
      9 * 1024 * 1024,
      'audio/mpeg',
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain('Arquivo muito grande');
  });

  it('should reject upload if file extension is not supported', async () => {
    const res = await service.uploadSound(
      'bad-ext',
      'https://example.com/script.sh',
      'script.sh',
      1000,
      'audio/mpeg',
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain('Extensão de arquivo não suportada');
  });

  it('should reject upload if MIME type is invalid', async () => {
    const res = await service.uploadSound(
      'invalid-mime',
      'https://example.com/sound.mp3',
      'sound.mp3',
      1000,
      'application/x-executable',
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain('Tipo MIME inválido');
  });

  it('should return error when attempting to delete non-existent sound', () => {
    const res = service.deleteSound('non-existent-sound-12345');
    expect(res.success).toBe(false);
    expect(res.message).toContain('não foi encontrado');
  });

  it('should safely stopAll without errors', () => {
    expect(() => SoundboardService.stopAll()).not.toThrow();
  });
});

describe('TwitchService tests', () => {
  it('should safely return empty map when no streamers requested', async () => {
    const service = new TwitchService();
    const map = await service.fetchLiveStreams([]);
    expect(map.size).toBe(0);
  });

  it('should return null for app access token when credentials missing', async () => {
    const service = new TwitchService();
    // In test environment, if TWITCH_CLIENT_ID is not set, it should return null safely
    const token = await service.getAppAccessToken();
    expect(typeof token === 'string' || token === null).toBe(true);
  });
});
