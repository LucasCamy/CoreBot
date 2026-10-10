-- CreateTable
CREATE TABLE "guild_configs" (
    "guildId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "botEnabled" BOOLEAN NOT NULL DEFAULT true,
    "adminRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "backupChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_configs_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "voice_notification_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "voiceChannelId" TEXT NOT NULL,
    "targetChannelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "joinMessage" TEXT NOT NULL DEFAULT '👋 {userMention} entrou no canal {channelMention}!',
    "leaveMessage" TEXT NOT NULL DEFAULT '🚪 {userMention} saiu do canal {channelMention}.',
    "moveMessage" TEXT DEFAULT '🔀 {userMention} mudou do canal {channelMention} para outro canal.',
    "mentionUser" BOOLEAN NOT NULL DEFAULT true,
    "useEmbed" BOOLEAN NOT NULL DEFAULT false,
    "embedColor" TEXT DEFAULT '#5865F2',
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_notification_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_events" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "reminderChannelId" TEXT NOT NULL,
    "reminderMinutesBefore" INTEGER[] DEFAULT ARRAY[60, 30, 10, 5]::INTEGER[],
    "repeatRule" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "sentReminders" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendee_lists" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "maxSlots" INTEGER,
    "closesAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendee_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendees" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birthday_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "announcementChannelId" TEXT NOT NULL,
    "customMessage" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastAnnouncedYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "birthday_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "targetChannelId" TEXT,
    "targetUserId" TEXT,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_notification_configs_guildId_voiceChannelId_key" ON "voice_notification_configs"("guildId", "voiceChannelId");

-- CreateIndex
CREATE INDEX "voice_notification_configs_guildId_idx" ON "voice_notification_configs"("guildId");

-- CreateIndex
CREATE INDEX "scheduled_events_guildId_status_idx" ON "scheduled_events"("guildId", "status");

-- CreateIndex
CREATE INDEX "scheduled_events_startsAt_idx" ON "scheduled_events"("startsAt");

-- CreateIndex
CREATE INDEX "attendee_lists_guildId_idx" ON "attendee_lists"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_listId_userId_key" ON "attendees"("listId", "userId");

-- CreateIndex
CREATE INDEX "attendees_listId_idx" ON "attendees"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "birthday_configs_guildId_userId_key" ON "birthday_configs"("guildId", "userId");

-- CreateIndex
CREATE INDEX "birthday_configs_guildId_idx" ON "birthday_configs"("guildId");

-- CreateIndex
CREATE INDEX "notification_logs_guildId_createdAt_idx" ON "notification_logs"("guildId", "createdAt");

-- AddForeignKey
ALTER TABLE "voice_notification_configs" ADD CONSTRAINT "voice_notification_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_events" ADD CONSTRAINT "scheduled_events_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendee_lists" ADD CONSTRAINT "attendee_lists_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_listId_fkey" FOREIGN KEY ("listId") REFERENCES "attendee_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthday_configs" ADD CONSTRAINT "birthday_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "voice_hub_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "hubChannelId" TEXT NOT NULL,
    "targetCategoryId" TEXT NOT NULL,
    "defaultUserLimit" INTEGER,
    "bitrate" INTEGER,
    "namingTemplate" TEXT NOT NULL DEFAULT '🔊 Sala de {user}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_hub_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_voice_channels" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_voice_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitored_servers" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "queryPort" INTEGER,
    "displayChannelId" TEXT NOT NULL,
    "messageId" TEXT,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitored_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "deployChannelId" TEXT,
    "alertsChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_hub_configs_guildId_hubChannelId_key" ON "voice_hub_configs"("guildId", "hubChannelId");
CREATE INDEX "voice_hub_configs_guildId_idx" ON "voice_hub_configs"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "active_voice_channels_channelId_key" ON "active_voice_channels"("channelId");
CREATE INDEX "active_voice_channels_guildId_idx" ON "active_voice_channels"("guildId");

-- CreateIndex
CREATE INDEX "monitored_servers_guildId_isActive_idx" ON "monitored_servers"("guildId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_configs_guildId_key" ON "webhook_configs"("guildId");

-- AddForeignKey
ALTER TABLE "voice_hub_configs" ADD CONSTRAINT "voice_hub_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "active_voice_channels" ADD CONSTRAINT "active_voice_channels_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monitored_servers" ADD CONSTRAINT "monitored_servers_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "custom_role_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "anchorRoleId" TEXT,
    "allowedRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_role_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_custom_roles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "iconUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_role_configs_guildId_key" ON "custom_role_configs"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "user_custom_roles_roleId_key" ON "user_custom_roles"("roleId");
CREATE UNIQUE INDEX "user_custom_roles_guildId_userId_key" ON "user_custom_roles"("guildId", "userId");
CREATE INDEX "user_custom_roles_guildId_idx" ON "user_custom_roles"("guildId");

-- AddForeignKey
ALTER TABLE "custom_role_configs" ADD CONSTRAINT "custom_role_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_custom_roles" ADD CONSTRAINT "user_custom_roles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable Quotes
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "savedById" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable Game Lobbies
CREATE TABLE "game_lobbies" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "gameName" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "maxPlayers" INTEGER,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "creatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_lobbies_pkey" PRIMARY KEY ("id")
);

-- CreateTable Lobby Participants
CREATE TABLE "lobby_participants" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lobby_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable Community Clips
CREATE TABLE "community_clips" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "game" TEXT,
    "submitterId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "cringes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_clips_pkey" PRIMARY KEY ("id")
);

-- CreateTable Clip Votes
CREATE TABLE "clip_votes" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clip_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable Tribunal Cases
CREATE TABLE "tribunal_cases" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "defendantId" TEXT NOT NULL,
    "originalNickname" TEXT,
    "punishmentNickname" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "durationHours" INTEGER NOT NULL,
    "votesYes" INTEGER NOT NULL DEFAULT 0,
    "votesNo" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'VOTING',
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "punishmentEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tribunal_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable Tribunal Votes
CREATE TABLE "tribunal_votes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tribunal_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable Voice Activity Logs
CREATE TABLE "voice_activity_logs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,

    CONSTRAINT "voice_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable Countdowns
CREATE TABLE "countdowns" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "countdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable Streamer Configs
CREATE TABLE "streamer_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "streamerLogin" TEXT NOT NULL,
    "discordUserId" TEXT,
    "channelId" TEXT NOT NULL,
    "lastStreamId" TEXT,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streamer_configs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "quotes_guildId_idx" ON "quotes"("guildId");
CREATE INDEX "game_lobbies_guildId_status_idx" ON "game_lobbies"("guildId", "status");
CREATE UNIQUE INDEX "lobby_participants_lobbyId_userId_key" ON "lobby_participants"("lobbyId", "userId");
CREATE INDEX "lobby_participants_lobbyId_idx" ON "lobby_participants"("lobbyId");
CREATE INDEX "community_clips_guildId_idx" ON "community_clips"("guildId");
CREATE UNIQUE INDEX "clip_votes_clipId_userId_key" ON "clip_votes"("clipId", "userId");
CREATE INDEX "clip_votes_clipId_idx" ON "clip_votes"("clipId");
CREATE INDEX "tribunal_cases_guildId_status_idx" ON "tribunal_cases"("guildId", "status");
CREATE UNIQUE INDEX "tribunal_votes_caseId_userId_key" ON "tribunal_votes"("caseId", "userId");
CREATE INDEX "tribunal_votes_caseId_idx" ON "tribunal_votes"("caseId");
CREATE INDEX "voice_activity_logs_guildId_joinedAt_idx" ON "voice_activity_logs"("guildId", "joinedAt");
CREATE INDEX "voice_activity_logs_userId_idx" ON "voice_activity_logs"("userId");
CREATE INDEX "countdowns_guildId_idx" ON "countdowns"("guildId");
CREATE UNIQUE INDEX "streamer_configs_guildId_streamerLogin_key" ON "streamer_configs"("guildId", "streamerLogin");
CREATE INDEX "streamer_configs_guildId_idx" ON "streamer_configs"("guildId");
CREATE INDEX "streamer_configs_streamerLogin_idx" ON "streamer_configs"("streamerLogin");

-- Foreign Keys
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_lobbies" ADD CONSTRAINT "game_lobbies_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lobby_participants" ADD CONSTRAINT "lobby_participants_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "game_lobbies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_clips" ADD CONSTRAINT "community_clips_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clip_votes" ADD CONSTRAINT "clip_votes_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "community_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tribunal_cases" ADD CONSTRAINT "tribunal_cases_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tribunal_votes" ADD CONSTRAINT "tribunal_votes_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "tribunal_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_activity_logs" ADD CONSTRAINT "voice_activity_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "countdowns" ADD CONSTRAINT "countdowns_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "streamer_configs" ADD CONSTRAINT "streamer_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;


