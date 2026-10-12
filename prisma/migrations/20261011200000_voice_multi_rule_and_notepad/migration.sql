-- AlterTable: Add eventType to voice_notification_configs
ALTER TABLE "voice_notification_configs" ADD COLUMN IF NOT EXISTS "eventType" TEXT NOT NULL DEFAULT 'ALL';

-- DropIndex: Drop old unique index to support multiple rules per channel
DROP INDEX IF EXISTS "voice_notification_configs_guildId_voiceChannelId_key";

-- CreateIndex: Add composite index for guildId and voiceChannelId
CREATE INDEX IF NOT EXISTS "voice_notification_configs_guildId_voiceChannelId_idx" ON "voice_notification_configs"("guildId", "voiceChannelId");

-- CreateTable: notepad_lists
CREATE TABLE IF NOT EXISTS "notepad_lists" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#5865F2',
    "isCollaborative" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notepad_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notepad_items
CREATE TABLE IF NOT EXISTS "notepad_items" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "addedByUserId" TEXT NOT NULL,
    "completedByUserId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notepad_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notepad_lists_guildId_idx" ON "notepad_lists"("guildId");
CREATE INDEX IF NOT EXISTS "notepad_lists_channelId_idx" ON "notepad_lists"("channelId");
CREATE INDEX IF NOT EXISTS "notepad_items_listId_idx" ON "notepad_items"("listId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notepad_lists_guildId_fkey'
    ) THEN
        ALTER TABLE "notepad_lists" ADD CONSTRAINT "notepad_lists_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notepad_items_listId_fkey'
    ) THEN
        ALTER TABLE "notepad_items" ADD CONSTRAINT "notepad_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "notepad_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
