import fs from 'node:fs';
import path from 'node:path';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
  DiscordGatewayAdapterCreator,
} from '@discordjs/voice';
import { Guild } from 'discord.js';
import ffmpegPath from 'ffmpeg-static';
import { z } from 'zod';
import { logger } from '../../../utils/logger.js';

export interface SoundItem {
  name: string;
  filename: string;
  path: string;
  extension: string;
  sizeKb: number;
}

const soundUploadSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_-]{2,32}$/,
      'O nome do som deve ter entre 2 e 32 caracteres e conter apenas letras, números, hífens (-) ou underlines (_).',
    ),
  sizeBytes: z
    .number()
    .max(
      8 * 1024 * 1024,
      'Arquivo muito grande! O limite máximo para áudios do soundboard é de **8 MB**.',
    ),
  contentType: z
    .string()
    .refine(
      (m) => ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav'].includes(m.toLowerCase()),
      'Tipo MIME inválido! Formatos permitidos: audio/mpeg (.mp3), audio/ogg (.ogg) e audio/wav (.wav).',
    ),
  extension: z
    .string()
    .refine(
      (ext) => ['.mp3', '.ogg', '.wav'].includes(ext.toLowerCase()),
      'Extensão de arquivo não suportada! Extensões permitidas: .mp3, .ogg ou .wav.',
    ),
});

export class SoundboardService {
  private static readonly SOUNDS_DIR = path.join(process.cwd(), 'assets', 'sounds');
  private static activeChannels = new Set<string>();
  private static activeCleanups = new Map<string, () => void>();

  constructor() {
    if (ffmpegPath && !process.env.FFMPEG_PATH) {
      process.env.FFMPEG_PATH = ffmpegPath;
    }

    // Ensure assets directory exists
    if (!fs.existsSync(SoundboardService.SOUNDS_DIR)) {
      fs.mkdirSync(SoundboardService.SOUNDS_DIR, { recursive: true });
    }
  }

  /**
   * Closes all active voice connections and clears in-memory playback locks (Graceful Shutdown).
   */
  public static stopAll(): void {
    logger.info(
      { activeCount: SoundboardService.activeCleanups.size },
      'Closing all active soundboard voice connections',
    );
    for (const [_key, cleanup] of SoundboardService.activeCleanups.entries()) {
      try {
        cleanup();
      } catch (err) {
        logger.warn({ err }, 'Error during soundboard connection teardown');
      }
    }
    SoundboardService.activeCleanups.clear();
    SoundboardService.activeChannels.clear();
  }

  public getAvailableSounds(): SoundItem[] {
    if (!fs.existsSync(SoundboardService.SOUNDS_DIR)) return [];

    const files = fs.readdirSync(SoundboardService.SOUNDS_DIR);
    const validExts = ['.mp3', '.ogg', '.wav', '.m4a'];

    const items: SoundItem[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!validExts.includes(ext)) continue;

      const fullPath = path.join(SoundboardService.SOUNDS_DIR, file);
      const stats = fs.statSync(fullPath);
      const name = path.basename(file, ext).toLowerCase();

      items.push({
        name,
        filename: file,
        path: fullPath,
        extension: ext.replace('.', ''),
        sizeKb: Math.round(stats.size / 1024),
      });
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Validates raw audio binary buffer headers (magic bytes) to prevent corrupt or disguised files.
   */
  private validateAudioBuffer(buffer: Buffer, ext: string): boolean {
    if (buffer.length < 4) return false;

    // MP3 check: ID3 tag header (0x49 0x44 0x33) or MPEG frame sync (0xFF and high 3 bits of next byte)
    if (ext === '.mp3') {
      const isId3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
      const isMpegSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
      return isId3 || isMpegSync;
    }

    // OGG check: starts with "OggS" (0x4F 0x67 0x67 0x53)
    if (ext === '.ogg') {
      return buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53;
    }

    // WAV check: starts with "RIFF" and has "WAVE" at offset 8
    if (ext === '.wav') {
      const isRiff =
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
      const isWave = buffer.length >= 12 && buffer.subarray(8, 12).toString('ascii') === 'WAVE';
      return isRiff && isWave;
    }

    return false;
  }

  /**
   * Uploads and stores a new sound file with strict Zod validation, buffer inspection, and 8 MB limit.
   */
  public async uploadSound(
    name: string,
    attachmentUrl: string,
    originalFilename: string,
    sizeBytes: number,
    contentType: string | null,
  ): Promise<{ success: boolean; message: string; soundItem?: SoundItem }> {
    const ext = path.extname(originalFilename).toLowerCase();

    // 1. Validate payload using strict Zod schema
    const parsed = soundUploadSchema.safeParse({
      name,
      sizeBytes,
      contentType: contentType ?? 'unknown',
      extension: ext,
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Dados de upload inválidos.';
      return {
        success: false,
        message: `❌ ${firstError}`,
      };
    }

    const sanitizedName = parsed.data.name;
    const targetFilename = `${sanitizedName}${ext}`;
    const targetPath = path.join(SoundboardService.SOUNDS_DIR, targetFilename);

    try {
      const response = await fetch(attachmentUrl);
      if (!response.ok) {
        return {
          success: false,
          message: `❌ Falha ao baixar o anexo do Discord (HTTP ${response.status}).`,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 2. Strict buffer size check
      const MAX_SIZE = 8 * 1024 * 1024;
      if (buffer.length > MAX_SIZE) {
        return {
          success: false,
          message:
            '❌ Arquivo muito grande! O limite máximo para áudios do soundboard é de **8 MB**.',
        };
      }

      // 3. Strict buffer magic bytes inspection
      const isGenuineAudio = this.validateAudioBuffer(buffer, ext);
      if (!isGenuineAudio) {
        return {
          success: false,
          message:
            '❌ O conteúdo binário do arquivo não corresponde a um formato de áudio válido (.mp3, .ogg ou .wav).',
        };
      }

      fs.writeFileSync(targetPath, buffer);

      const stats = fs.statSync(targetPath);
      const soundItem: SoundItem = {
        name: sanitizedName,
        filename: targetFilename,
        path: targetPath,
        extension: ext.replace('.', ''),
        sizeKb: Math.round(stats.size / 1024),
      };

      logger.info(
        { soundName: sanitizedName, sizeKb: soundItem.sizeKb },
        'New sound uploaded to soundboard',
      );

      return {
        success: true,
        message: `✅ Som **\`${sanitizedName}\`** (${soundItem.extension.toUpperCase()}, ${soundItem.sizeKb} KB) adicionado com sucesso!`,
        soundItem,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message, name: sanitizedName }, 'Failed to save sound file');
      return {
        success: false,
        message: '❌ Erro interno ao salvar o arquivo de áudio.',
      };
    }
  }

  /**
   * Deletes an existing sound file.
   */
  public deleteSound(name: string): { success: boolean; message: string } {
    const sanitizedName = name.trim().toLowerCase();
    const available = this.getAvailableSounds();
    const soundItem = available.find((s) => s.name === sanitizedName);

    if (!soundItem) {
      return {
        success: false,
        message: `❌ Som **"${sanitizedName}"** não foi encontrado no soundboard.`,
      };
    }

    try {
      if (fs.existsSync(soundItem.path)) {
        fs.unlinkSync(soundItem.path);
        logger.info({ soundName: sanitizedName }, 'Sound deleted from soundboard');
        return {
          success: true,
          message: `🗑️ Som **\`${sanitizedName}\`** removido com sucesso do soundboard.`,
        };
      }
      return {
        success: false,
        message: '❌ Arquivo físico não encontrado.',
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message, name: sanitizedName }, 'Failed to delete sound file');
      return {
        success: false,
        message: '❌ Erro ao excluir arquivo de áudio.',
      };
    }
  }

  public async playSound(
    guild: Guild,
    voiceChannelId: string,
    soundName: string,
  ): Promise<{ success: boolean; message: string; soundItem?: SoundItem }> {
    const channelKey = `${guild.id}:${voiceChannelId}`;

    if (SoundboardService.activeChannels.has(channelKey)) {
      return {
        success: false,
        message: '⚠️ Já há um som sendo reproduzido nesta sala de voz no momento!',
      };
    }

    const available = this.getAvailableSounds();
    const query = soundName.trim().toLowerCase();
    const soundItem = available.find((s) => s.name === query || s.filename.toLowerCase() === query);

    if (!soundItem) {
      return {
        success: false,
        message: `❌ Som **"${soundName}"** não encontrado! Digite \`/sons listar\` para ver os áudios disponíveis.`,
      };
    }

    SoundboardService.activeChannels.add(channelKey);

    let memberCheckInterval: NodeJS.Timeout | null = null;
    let safetyTimeout: NodeJS.Timeout | null = null;
    let isCleanedUp = false;

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannelId,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
        selfDeaf: true,
        selfMute: false,
      });

      // Wait up to 5 seconds for connection to be ready
      await entersState(connection, VoiceConnectionStatus.Ready, 5_000);

      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
        },
      });

      const resource = createAudioResource(soundItem.path, {
        inlineVolume: true,
      });

      if (resource.volume) {
        resource.volume.setVolume(1.0);
      }

      connection.subscribe(player);
      player.play(resource);

      logger.info(
        { guildId: guild.id, channelId: voiceChannelId, sound: soundItem.name },
        'Playing soundboard audio in voice channel',
      );

      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;

        if (memberCheckInterval) {
          clearInterval(memberCheckInterval);
          memberCheckInterval = null;
        }

        if (safetyTimeout) {
          clearTimeout(safetyTimeout);
          safetyTimeout = null;
        }

        SoundboardService.activeChannels.delete(channelKey);
        SoundboardService.activeCleanups.delete(channelKey);

        try {
          player.stop();
          connection.destroy();
          logger.debug(
            { guildId: guild.id, channelId: voiceChannelId },
            'Cleaned up soundboard voice connection',
          );
        } catch {
          // ignore cleanup errors
        }
      };

      // Register cleanup handler for global graceful shutdown
      SoundboardService.activeCleanups.set(channelKey, cleanup);

      // Auto disconnect when sound finishes
      player.on(AudioPlayerStatus.Idle, () => {
        cleanup();
      });

      player.on('error', (err) => {
        logger.error(
          { error: err, sound: soundItem.name },
          'Error during soundboard audio playback',
        );
        cleanup();
      });

      // Handle connection disconnects and errors
      connection.on(VoiceConnectionStatus.Disconnected, () => {
        logger.warn(
          { guildId: guild.id, channelId: voiceChannelId },
          'VoiceConnection disconnected unexpectedly',
        );
        cleanup();
      });

      connection.on(VoiceConnectionStatus.Destroyed, () => {
        cleanup();
      });

      connection.on('error', (err) => {
        logger.error(
          { error: err, guildId: guild.id, channelId: voiceChannelId },
          'VoiceConnection error occurred',
        );
        cleanup();
      });

      // Actively verify if all human members leave the voice channel
      memberCheckInterval = setInterval(() => {
        const channel = guild.channels.cache.get(voiceChannelId);
        if (channel && channel.isVoiceBased()) {
          const humanMembers = channel.members.filter((m) => !m.user.bot);
          if (humanMembers.size === 0) {
            logger.info(
              { guildId: guild.id, channelId: voiceChannelId },
              'All members left the voice channel. Terminating soundboard playback immediately.',
            );
            cleanup();
          }
        }
      }, 1_500);

      // Safety fallback: disconnect after 30 seconds max
      safetyTimeout = setTimeout(() => {
        if (!isCleanedUp) {
          cleanup();
        }
      }, 30_000);

      return {
        success: true,
        message: `🔊 Tocando **"${soundItem.name}"** no canal de voz!`,
        soundItem,
      };
    } catch (error) {
      if (memberCheckInterval) clearInterval(memberCheckInterval);
      if (safetyTimeout) clearTimeout(safetyTimeout);
      SoundboardService.activeChannels.delete(channelKey);
      SoundboardService.activeCleanups.delete(channelKey);

      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        { error: err.message, guildId: guild.id, channelId: voiceChannelId },
        'Failed to connect or play sound in voice channel',
      );
      return {
        success: false,
        message: '❌ Erro ao conectar à sala de voz ou reproduzir o áudio.',
      };
    }
  }
}
