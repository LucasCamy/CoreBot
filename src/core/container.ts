import { PrismaClient } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { GuildCacheService } from './cache/guild-cache.service.js';
import { GuildRepository } from '../database/repositories/guild.repository.js';
import { VoiceRepository } from '../database/repositories/voice.repository.js';
import { AgendaRepository } from '../database/repositories/agenda.repository.js';
import { AttendeeRepository } from '../database/repositories/attendee.repository.js';
import { BirthdayRepository } from '../database/repositories/birthday.repository.js';
import { NotificationLogRepository } from '../database/repositories/notification-log.repository.js';
import { VoiceHubRepository } from '../database/repositories/voice-hub.repository.js';
import { GameServerRepository } from '../database/repositories/game-server.repository.js';
import { WebhookRepository } from '../database/repositories/webhook.repository.js';
import { CustomRoleRepository } from '../database/repositories/custom-role.repository.js';
import { QuoteRepository } from '../database/repositories/quote.repository.js';
import { MatchmakingRepository } from '../database/repositories/matchmaking.repository.js';
import { ClipRepository } from '../database/repositories/clip.repository.js';
import { TribunalRepository } from '../database/repositories/tribunal.repository.js';
import { SocialAnalyticsRepository } from '../database/repositories/social-analytics.repository.js';
import { StreamerRepository } from '../database/repositories/streamer.repository.js';
import { NotepadRepository } from '../database/repositories/notepad.repository.js';
import { SystemMessagesRepository } from '../database/repositories/system-messages.repository.js';
import { MessageTemplateService } from '../services/template.service.js';
import { NotificationService } from '../services/notification.service.js';
import { CoreBotClient } from '../discord/client.js';
import { AgendaScheduler } from '../jobs/schedulers/agenda.scheduler.js';
import { BirthdayScheduler } from '../jobs/schedulers/birthday.scheduler.js';
import { QuotesScheduler } from '../jobs/schedulers/quotes.scheduler.js';
import { MatchmakingScheduler } from '../jobs/schedulers/matchmaking.scheduler.js';
import { ClipsScheduler } from '../jobs/schedulers/clips.scheduler.js';
import { TribunalScheduler } from '../jobs/schedulers/tribunal.scheduler.js';
import { SocialAnalyticsScheduler } from '../jobs/schedulers/social-analytics.scheduler.js';
import { CleanupScheduler } from '../jobs/schedulers/cleanup.scheduler.js';
import { BackupScheduler } from '../jobs/schedulers/backup.scheduler.js';
import { TwitchScheduler } from '../jobs/schedulers/twitch.scheduler.js';
import { PresenceService } from '../discord/presence.service.js';

export class Container {
  public readonly prisma: PrismaClient;
  public readonly guildCacheService: GuildCacheService;
  public readonly guildRepository: GuildRepository;
  public readonly voiceRepository: VoiceRepository;
  public readonly agendaRepository: AgendaRepository;
  public readonly attendeeRepository: AttendeeRepository;
  public readonly birthdayRepository: BirthdayRepository;
  public readonly notificationLogRepository: NotificationLogRepository;
  public readonly voiceHubRepository: VoiceHubRepository;
  public readonly gameServerRepository: GameServerRepository;
  public readonly webhookRepository: WebhookRepository;
  public readonly customRoleRepository: CustomRoleRepository;
  public readonly quoteRepository: QuoteRepository;
  public readonly matchmakingRepository: MatchmakingRepository;
  public readonly clipRepository: ClipRepository;
  public readonly tribunalRepository: TribunalRepository;
  public readonly socialAnalyticsRepository: SocialAnalyticsRepository;
  public readonly streamerRepository: StreamerRepository;
  public readonly notepadRepository: NotepadRepository;
  public readonly systemMessagesRepository: SystemMessagesRepository;
  public readonly templateService: MessageTemplateService;
  public readonly notificationService: NotificationService;
  public readonly presenceService: PresenceService;
  public readonly agendaScheduler: AgendaScheduler;
  public readonly birthdayScheduler: BirthdayScheduler;
  public readonly quotesScheduler: QuotesScheduler;
  public readonly matchmakingScheduler: MatchmakingScheduler;
  public readonly clipsScheduler: ClipsScheduler;
  public readonly tribunalScheduler: TribunalScheduler;
  public readonly socialAnalyticsScheduler: SocialAnalyticsScheduler;
  public readonly cleanupScheduler: CleanupScheduler;
  public readonly backupScheduler: BackupScheduler;
  public readonly twitchScheduler: TwitchScheduler;
  public client!: CoreBotClient;

  constructor(discordClient: CoreBotClient) {
    this.client = discordClient;
    this.prisma = prisma;

    // Cache L1
    this.guildCacheService = new GuildCacheService();

    // Repositories
    this.guildRepository = new GuildRepository(this.prisma, this.guildCacheService);
    this.voiceRepository = new VoiceRepository(this.prisma);
    this.agendaRepository = new AgendaRepository(this.prisma);
    this.attendeeRepository = new AttendeeRepository(this.prisma);
    this.birthdayRepository = new BirthdayRepository(this.prisma);
    this.notificationLogRepository = new NotificationLogRepository(this.prisma);
    this.voiceHubRepository = new VoiceHubRepository(this.prisma);
    this.gameServerRepository = new GameServerRepository(this.prisma);
    this.webhookRepository = new WebhookRepository(this.prisma);
    this.customRoleRepository = new CustomRoleRepository(this.prisma);
    this.quoteRepository = new QuoteRepository(this.prisma);
    this.matchmakingRepository = new MatchmakingRepository(this.prisma);
    this.clipRepository = new ClipRepository(this.prisma);
    this.tribunalRepository = new TribunalRepository(this.prisma);
    this.socialAnalyticsRepository = new SocialAnalyticsRepository(this.prisma);
    this.streamerRepository = new StreamerRepository(this.prisma);
    this.notepadRepository = new NotepadRepository(this.prisma);
    this.systemMessagesRepository = new SystemMessagesRepository(this.prisma);

    // Services
    this.templateService = new MessageTemplateService();
    this.notificationService = new NotificationService(this.client, this.notificationLogRepository);
    this.presenceService = new PresenceService(this);

    // Schedulers
    this.agendaScheduler = new AgendaScheduler(this);
    this.birthdayScheduler = new BirthdayScheduler(this);
    this.quotesScheduler = new QuotesScheduler(this);
    this.matchmakingScheduler = new MatchmakingScheduler(this);
    this.clipsScheduler = new ClipsScheduler(this);
    this.tribunalScheduler = new TribunalScheduler(this);
    this.socialAnalyticsScheduler = new SocialAnalyticsScheduler(this);
    this.cleanupScheduler = new CleanupScheduler(this);
    this.backupScheduler = new BackupScheduler(this);
    this.twitchScheduler = new TwitchScheduler(this);
  }
}
