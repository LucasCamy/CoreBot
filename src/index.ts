import { Events } from 'discord.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { PrismaService } from './database/prisma.js';
import { CoreBotClient } from './discord/client.js';
import { Container } from './core/container.js';
import { ModuleRegistry } from './core/module.registry.js';
import { handleInteraction } from './discord/handlers/interaction.handler.js';
import { deployCommands } from './discord/deploy-commands.js';
import { startHttpServer, stopHttpServer } from './utils/http.server.js';
import { QueueManager } from './jobs/queue.js';
import { RedisManager } from './jobs/redis.js';
import { SoundboardService } from './modules/soundboard/services/soundboard.service.js';

// Import All Feature Modules
import { AdminModule } from './modules/admin/index.js';
import { VoiceNotificationModule } from './modules/voice-notifications/index.js';
import { AgendaModule } from './modules/agenda/index.js';
import { AttendeeListsModule } from './modules/attendee-lists/index.js';
import { BirthdayModule } from './modules/birthdays/index.js';
import { VoiceHubModule } from './modules/voice-hub/index.js';
import { GameMonitorModule } from './modules/game-monitor/index.js';
import { WebhooksModule } from './modules/webhooks/index.js';
import { CustomRolesModule } from './modules/custom-roles/index.js';
import { QuotesModule } from './modules/quotes/index.js';
import { MatchmakingModule } from './modules/matchmaking/index.js';
import { ClipsModule } from './modules/clips/index.js';
import { TribunalModule } from './modules/tribunal/index.js';
import { SoundboardModule } from './modules/soundboard/index.js';
import { SocialAnalyticsModule } from './modules/social-analytics/index.js';
import { StreamNotifierModule } from './modules/stream-notifier/index.js';

async function bootstrap(): Promise<void> {
  logger.info('====================================================');
  logger.info(`Starting CoreBot (Node.js ${process.version})`);
  logger.info(`Environment: ${env.NODE_ENV} | Log Level: ${env.LOG_LEVEL}`);
  logger.info(`Allowed Guilds: [${env.DISCORD_ALLOWED_GUILD_IDS.join(', ')}]`);
  logger.info('====================================================');

  // 1. Connect Database
  await PrismaService.connect();

  // 2. Initialize Discord Client & DI Container
  const client = new CoreBotClient();
  const container = new Container(client);
  client.setContainer(container);

  // 3. Initialize Module Registry & Register Modules
  const moduleRegistry = new ModuleRegistry(container);
  moduleRegistry.register(AdminModule);
  moduleRegistry.register(VoiceNotificationModule);
  moduleRegistry.register(AgendaModule);
  moduleRegistry.register(AttendeeListsModule);
  moduleRegistry.register(BirthdayModule);
  moduleRegistry.register(VoiceHubModule);
  moduleRegistry.register(GameMonitorModule);
  moduleRegistry.register(WebhooksModule);
  moduleRegistry.register(CustomRolesModule);
  moduleRegistry.register(QuotesModule);
  moduleRegistry.register(MatchmakingModule);
  moduleRegistry.register(ClipsModule);
  moduleRegistry.register(TribunalModule);
  moduleRegistry.register(SoundboardModule);
  moduleRegistry.register(SocialAnalyticsModule);
  moduleRegistry.register(StreamNotifierModule);

  // 4. Initialize Modules, Commands, Handlers & Schedulers
  await moduleRegistry.initAll();

  // 5. Deploy Slash and Context Menu Commands scoped exclusively to authorized guilds
  const commandsList = Array.from(client.commands.values());
  const contextMenuCommandsList = Array.from(client.contextMenuCommands.values());
  await deployCommands(commandsList, contextMenuCommandsList);

  // 6. Bind Discord Interaction Create Event
  client.on(Events.InteractionCreate, async (interaction) => {
    await handleInteraction(client, interaction);
  });

  // 7. Bind Client Ready Event
  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Logged into Discord as ${readyClient.user.tag} (ID: ${readyClient.user.id})`);
    // Start dynamic rich presence
    container.presenceService.start();
  });

  // 8. Start Fastify HTTP Server (Healthcheck, Bull-Board, Metrics, Webhooks)
  await startHttpServer(container);

  // 9. Login to Discord Gateway
  await client.login(env.BOT_TOKEN);

  // 10. Graceful Shutdown Handler
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown of CoreBot...`);

    // Safety timeout: force exit after 10 seconds if any connection remains pending
    const forceExitTimeout = setTimeout(() => {
      logger.fatal('Graceful shutdown timed out after 10 seconds. Forcing process exit.');
      process.exit(1);
    }, 10_000);
    forceExitTimeout.unref();

    try {
      // Step 1: Deactivate new jobs and close BullMQ workers, then queues
      container.presenceService.stop();
      container.agendaScheduler.stop();
      container.birthdayScheduler.stop();
      container.quotesScheduler.stop();
      container.matchmakingScheduler.stop();
      container.clipsScheduler.stop();
      container.tribunalScheduler.stop();
      container.socialAnalyticsScheduler.stop();
      container.cleanupScheduler.stop();
      container.backupScheduler.stop();
      container.twitchScheduler.stop();

      await moduleRegistry.shutdownAll();
      await QueueManager.closeWorkers();
      await QueueManager.closeQueues();

      // Step 2: Close active Discord audio connections and clear playback locks
      SoundboardService.stopAll();

      // Step 3: Close Fastify HTTP server
      await stopHttpServer();

      // Step 4: Disconnect Discord client
      await client.destroy();

      // Step 5: Disconnect infrastructure clients (PostgreSQL and Redis)
      await PrismaService.disconnect();
      await RedisManager.close();

      logger.info('CoreBot graceful shutdown completed successfully.');
      clearTimeout(forceExitTimeout);
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error encountered during shutdown');
      clearTimeout(forceExitTimeout);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled Promise Rejection detected');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught Exception detected in runtime');
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.fatal({ error }, 'Fatal error during CoreBot startup bootstrap');
  process.exit(1);
});
