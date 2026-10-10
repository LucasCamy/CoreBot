import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { Container } from '../../core/container.js';
import { QUEUE_NAMES, BOT_COLORS } from '../../config/constants.js';
import { QueueManager } from '../queue.js';
import { logger } from '../../utils/logger.js';
import { nowInTimezone } from '../../utils/time.js';
import { GuildGuard } from '../../discord/guards/guild.guard.js';
import { EmbedBuilder } from 'discord.js';

export class BackupScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastExecutedDateByGuild: Map<string, string> = new Map();

  constructor(private readonly container: Container) {}

  public async start(): Promise<void> {
    logger.info('Starting Database Backup Scheduler worker...');

    // Pre-initialize queue for Bull-Board visibility
    QueueManager.getQueue(QUEUE_NAMES.DATABASE_BACKUP);

    QueueManager.registerWorker(
      QUEUE_NAMES.DATABASE_BACKUP,
      async (job) => {
        const { guildId } = job.data as { guildId: string };
        logger.info({ jobId: job.id, guildId }, 'Executing automated daily PostgreSQL backup');
        await this.runBackup(guildId);
      },
      { concurrency: 1 },
    );

    // Initial check on startup
    await this.checkBackupSchedule();

    // Check every 15 minutes
    this.timer = setInterval(
      () => {
        this.checkBackupSchedule().catch((err) => {
          logger.error({ error: err }, 'Error checking database backup schedule');
        });
      },
      15 * 60 * 1000,
    );
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkBackupSchedule(): Promise<void> {
    const allowedGuilds = GuildGuard.getAllowedGuildIds();

    for (const guildId of allowedGuilds) {
      const guildConfig = await this.container.guildRepository.findByGuildId(guildId);
      if (!guildConfig || !guildConfig.botEnabled || !guildConfig.backupChannelId) {
        continue;
      }

      const tz = guildConfig.timezone || 'America/Sao_Paulo';
      const now = nowInTimezone(tz);

      // Runs daily at 04:00 AM
      const isAfter4AM = now.hour() >= 4;
      const todayDateKey = now.format('YYYY-MM-DD');

      if (!isAfter4AM) {
        continue;
      }

      if (this.lastExecutedDateByGuild.get(guildId) === todayDateKey) {
        continue;
      }

      this.lastExecutedDateByGuild.set(guildId, todayDateKey);
      const queue = QueueManager.getQueue(QUEUE_NAMES.DATABASE_BACKUP);
      await queue.add(
        `backup-${guildId}-${todayDateKey}`,
        { guildId, date: todayDateKey },
        { jobId: `backup-${guildId}-${todayDateKey}` },
      );
    }
  }

  /**
   * Executes pg_dump, compresses to .sql.gz, sends as attachment to Discord and cleans up disk.
   */
  public async runBackup(guildId: string): Promise<void> {
    const guildConfig = await this.container.guildRepository.findByGuildId(guildId);
    if (!guildConfig || !guildConfig.backupChannelId) {
      logger.warn({ guildId }, 'Backup skipped: No backupChannelId configured for guild');
      return;
    }

    const backupChannelId = guildConfig.backupChannelId;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      logger.error('Cannot run database backup: DATABASE_URL is not set in environment');
      return;
    }

    // Parse connection string
    let host: string;
    let port: string;
    let username: string;
    let password = '';
    let database: string;

    try {
      const parsed = new URL(databaseUrl);
      host = parsed.hostname;
      port = parsed.port || '5432';
      username = decodeURIComponent(parsed.username);
      password = decodeURIComponent(parsed.password);
      database = parsed.pathname.replace(/^\//, '').split('?')[0];
    } catch (parseErr) {
      logger.error({ error: parseErr }, 'Failed to parse DATABASE_URL for pg_dump');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tempGzFile = path.join(os.tmpdir(), `corebot-backup-${timestamp}.sql.gz`);

    try {
      await this.executePgDumpGzip({
        host,
        port,
        username,
        password,
        database,
        targetFilePath: tempGzFile,
      });

      const stats = fs.statSync(tempGzFile);
      const sizeBytes = stats.size;
      const sizeKb = Math.round(sizeBytes / 1024);
      const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
      const DISCORD_SAFE_ATTACHMENT_LIMIT = 20 * 1024 * 1024; // 20 MB safe threshold for Discord API

      const channel = await this.container.client.channels.fetch(backupChannelId);

      if (sizeBytes > DISCORD_SAFE_ATTACHMENT_LIMIT) {
        // Exceeds Discord attachment limit: preserve in server volume
        const backupDir =
          process.env.BACKUP_DIR ||
          (fs.existsSync('/usr/src/app/backups')
            ? '/usr/src/app/backups'
            : fs.existsSync('/app/backups')
              ? '/app/backups'
              : path.join(process.cwd(), 'backups'));

        fs.mkdirSync(backupDir, { recursive: true });
        const persistentPath = path.join(backupDir, `corebot-backup-${timestamp}.sql.gz`);
        fs.copyFileSync(tempGzFile, persistentPath);

        logger.warn(
          { sizeBytes, sizeMb, persistentPath },
          'Compressed database backup exceeds 20MB Discord limit. Saved to server volume.',
        );

        if (channel && channel.isTextBased() && 'send' in channel) {
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(BOT_COLORS.WARNING)
                .setTitle('⚠️ Backup Preservado em Volume Local')
                .setDescription(
                  `⚠️ Backup gerado localmente com sucesso, mas o tamanho (${sizeMb} MB) excede o limite de anexo do Discord. Arquivo preservado no volume do servidor em \`${persistentPath}\`.`,
                )
                .addFields(
                  { name: 'Banco de Dados', value: `\`${database}\``, inline: true },
                  { name: 'Tamanho', value: `\`${sizeMb} MB\` (${sizeKb} KB)`, inline: true },
                  { name: 'Data', value: `\`${timestamp}\``, inline: true },
                )
                .setTimestamp(),
            ],
          });
        }
        return;
      }

      // Size is <= 20 MB: deliver directly as Discord attachment
      if (channel && channel.isTextBased() && 'send' in channel) {
        const embed = new EmbedBuilder()
          .setColor(BOT_COLORS.SUCCESS)
          .setTitle('🐘 Backup do Banco de Dados Concluído')
          .setDescription(
            `A cópia de segurança diária do PostgreSQL foi gerada e compactada com sucesso.\n\n• **Banco:** \`${database}\`\n• **Tamanho compactado:** \`${sizeKb} KB\` (${sizeMb} MB)\n• **Timestamp:** \`${timestamp}\``,
          )
          .setTimestamp();

        await channel.send({
          embeds: [embed],
          files: [
            {
              attachment: tempGzFile,
              name: `corebot-backup-${timestamp}.sql.gz`,
            },
          ],
        });

        logger.info(
          { guildId, backupChannelId, sizeKb },
          'Automated database backup successfully delivered to Discord',
        );
      } else {
        logger.warn({ backupChannelId }, 'Configured backup channel is not a valid text channel');
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        { error: err.message, stack: err.stack, guildId },
        'Automated database backup routine failed',
      );

      try {
        const channel = await this.container.client.channels.fetch(backupChannelId);
        if (channel && channel.isTextBased() && 'send' in channel) {
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(BOT_COLORS.DANGER)
                .setTitle('❌ Falha no Backup Diário do PostgreSQL')
                .setDescription(
                  `Ocorreu um erro ao gerar o dump do banco de dados:\n\`\`\`${err.message}\`\`\``,
                )
                .setTimestamp(),
            ],
          });
        }
      } catch {
        // Ignore secondary notification errors
      }
    } finally {
      // Always remove temporary file from local disk
      if (fs.existsSync(tempGzFile)) {
        try {
          fs.unlinkSync(tempGzFile);
          logger.debug({ tempGzFile }, 'Temporary backup file deleted from disk');
        } catch (cleanupErr) {
          logger.warn({ cleanupErr }, 'Failed to delete temporary backup file');
        }
      }
    }
  }

  /**
   * Spawns pg_dump and pipes output through gzip into targetFilePath.
   */
  private executePgDumpGzip(params: {
    host: string;
    port: string;
    username: string;
    password: string;
    database: string;
    targetFilePath: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const { host, port, username, password, database, targetFilePath } = params;

      const pgDump = spawn(
        'pg_dump',
        ['-h', host, '-p', port, '-U', username, '-d', database, '-F', 'p', '--no-owner'],
        {
          env: {
            ...process.env,
            PGPASSWORD: password,
          },
        },
      );

      const gzip = zlib.createGzip();
      const outputStream = fs.createWriteStream(targetFilePath);

      let stderrOutput = '';

      pgDump.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });

      pgDump.on('error', (err) => {
        reject(
          new Error(
            `Falha ao iniciar processo 'pg_dump': ${err.message}. Verifique se postgresql-client está instalado no sistema.`,
          ),
        );
      });

      pgDump.stdout.pipe(gzip).pipe(outputStream);

      outputStream.on('finish', () => {
        if (stderrOutput && stderrOutput.toLowerCase().includes('error')) {
          reject(new Error(`Erro no pg_dump: ${stderrOutput}`));
        } else {
          resolve();
        }
      });

      outputStream.on('error', (err) => {
        reject(err);
      });
    });
  }
}
