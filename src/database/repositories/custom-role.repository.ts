import { CustomRoleConfig, PrismaClient, UserCustomRole } from '@prisma/client';

export class CustomRoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async getConfig(guildId: string): Promise<CustomRoleConfig | null> {
    return this.prisma.customRoleConfig.findUnique({
      where: { guildId },
    });
  }

  public async upsertConfig(
    guildId: string,
    data: {
      enabled?: boolean;
      anchorRoleId?: string | null;
      allowedRoleIds?: string[];
    },
  ): Promise<CustomRoleConfig> {
    await this.prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId },
      update: {},
    });

    return this.prisma.customRoleConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        enabled: data.enabled ?? true,
        anchorRoleId: data.anchorRoleId,
        allowedRoleIds: data.allowedRoleIds ?? [],
      },
      update: {
        enabled: data.enabled,
        anchorRoleId: data.anchorRoleId,
        allowedRoleIds: data.allowedRoleIds,
      },
    });
  }

  public async findByUser(guildId: string, userId: string): Promise<UserCustomRole | null> {
    return this.prisma.userCustomRole.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });
  }

  public async findByRoleId(roleId: string): Promise<UserCustomRole | null> {
    return this.prisma.userCustomRole.findUnique({
      where: { roleId },
    });
  }

  public async createCustomRole(data: {
    guildId: string;
    userId: string;
    roleId: string;
    name: string;
    color: string;
    iconUrl?: string | null;
  }): Promise<UserCustomRole> {
    await this.prisma.guildConfig.upsert({
      where: { guildId: data.guildId },
      create: { guildId: data.guildId },
      update: {},
    });

    return this.prisma.userCustomRole.create({
      data: {
        guildId: data.guildId,
        userId: data.userId,
        roleId: data.roleId,
        name: data.name,
        color: data.color,
        iconUrl: data.iconUrl,
      },
    });
  }

  public async updateCustomRole(
    id: string,
    data: { name?: string; color?: string; iconUrl?: string | null },
  ): Promise<UserCustomRole> {
    return this.prisma.userCustomRole.update({
      where: { id },
      data,
    });
  }

  public async deleteCustomRole(guildId: string, userId: string): Promise<UserCustomRole | null> {
    const existing = await this.findByUser(guildId, userId);
    if (!existing) return null;

    return this.prisma.userCustomRole.delete({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });
  }

  public async deleteByRoleId(roleId: string): Promise<UserCustomRole | null> {
    const existing = await this.findByRoleId(roleId);
    if (!existing) return null;

    return this.prisma.userCustomRole.delete({
      where: { roleId },
    });
  }
}
