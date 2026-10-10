import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

class PrismaService {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaClient({
        log: [
          { level: 'warn', emit: 'event' },
          { level: 'error', emit: 'event' },
        ],
      });

      // Bind Prisma events to structured logger
      // @ts-expect-error Prisma event typing
      PrismaService.instance.$on('warn', (e: { message: string }) => {
        logger.warn({ prismaMessage: e.message }, 'Prisma warning emitted');
      });

      // @ts-expect-error Prisma event typing
      PrismaService.instance.$on('error', (e: { message: string }) => {
        logger.error({ prismaMessage: e.message }, 'Prisma error emitted');
      });
    }

    return PrismaService.instance;
  }

  public static async connect(): Promise<void> {
    const client = PrismaService.getInstance();
    await client.$connect();
    logger.info('Connected to PostgreSQL database via Prisma');
  }

  public static async disconnect(): Promise<void> {
    if (PrismaService.instance) {
      await PrismaService.instance.$disconnect();
      logger.info('Disconnected from PostgreSQL database');
    }
  }
}

export const prisma = PrismaService.getInstance();
export { PrismaService };
