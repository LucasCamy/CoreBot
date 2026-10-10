-- AlterTable
ALTER TABLE "voice_hub_configs" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "active_voice_channels" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whitelistedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
