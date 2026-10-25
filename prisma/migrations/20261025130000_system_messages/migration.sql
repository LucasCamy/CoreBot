-- CreateTable: system_message_configs
CREATE TABLE IF NOT EXISTS "system_message_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "welcomeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "welcomeChannelId" TEXT,
    "welcomeMessage" TEXT NOT NULL DEFAULT '👋 Seja bem-vindo(a) ao **{server}**, {userMention}! Agora somos **{memberCount}** membros.',
    "welcomeUseEmbed" BOOLEAN NOT NULL DEFAULT true,
    "welcomeColor" TEXT DEFAULT '#5865F2',
    "boostEnabled" BOOLEAN NOT NULL DEFAULT true,
    "boostChannelId" TEXT,
    "boostMessage" TEXT NOT NULL DEFAULT '🚀 **{userMention}** acabou de impulsionar o servidor! Muito obrigado pelo apoio! O **{server}** agora conta com **{boostCount}** impulsos. 🎉',
    "boostUseEmbed" BOOLEAN NOT NULL DEFAULT true,
    "boostColor" TEXT DEFAULT '#F47FFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_message_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "system_message_configs_guildId_key" ON "system_message_configs"("guildId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'system_message_configs_guildId_fkey'
    ) THEN
        ALTER TABLE "system_message_configs" ADD CONSTRAINT "system_message_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configs"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
