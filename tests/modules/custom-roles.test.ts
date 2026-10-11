import { describe, it, expect, vi } from 'vitest';
import {
  createCustomRoleSchema,
  updateColorSchema,
  updateNameSchema,
} from '../../src/modules/custom-roles/schemas/custom-role.schema.js';
import { CustomRoleService } from '../../src/modules/custom-roles/services/custom-role.service.js';
import { Container } from '../../src/core/container.js';
import { Guild, GuildMember, PermissionsBitField, PermissionFlagsBits, Role } from 'discord.js';

describe('Custom Roles Module', () => {
  describe('Schema Validations', () => {
    it('should accept valid hex colors and valid names', () => {
      const valid = createCustomRoleSchema.safeParse({
        name: 'VIP Bronze',
        color: '#FF5733',
      });
      expect(valid.success).toBe(true);

      const validLower = updateColorSchema.safeParse({ color: '#5865f2' });
      expect(validLower.success).toBe(true);
    });

    it('should reject invalid hex colors (too short, too long, missing # or invalid hex chars)', () => {
      expect(updateColorSchema.safeParse({ color: '#FFF' }).success).toBe(false);
      expect(updateColorSchema.safeParse({ color: 'FF5733' }).success).toBe(false);
      expect(updateColorSchema.safeParse({ color: '#1234567' }).success).toBe(false);
      expect(updateColorSchema.safeParse({ color: '#GGGGGG' }).success).toBe(false);
      expect(updateColorSchema.safeParse({ color: 'blue' }).success).toBe(false);
    });

    it('should reject names with mentions or illegal length', () => {
      expect(updateNameSchema.safeParse({ name: '@everyone' }).success).toBe(false);
      expect(updateNameSchema.safeParse({ name: '#canal' }).success).toBe(false);
      expect(updateNameSchema.safeParse({ name: '' }).success).toBe(false);
      expect(updateNameSchema.safeParse({ name: 'a'.repeat(51) }).success).toBe(false);
    });
  });

  describe('CustomRoleService Business Logic', () => {
    const mockRepo = {
      getConfig: vi.fn(),
      findByUser: vi.fn(),
      createCustomRole: vi.fn(),
    };

    const container = {
      customRoleRepository: mockRepo,
    } as unknown as Container;

    const service = new CustomRoleService(container);

    it('should prevent user from creating more than 1 custom role', async () => {
      mockRepo.getConfig.mockResolvedValue({ enabled: true, allowedRoleIds: [] });
      mockRepo.findByUser.mockResolvedValue({ id: 'cr-1', roleId: 'role-123' });

      const mockMember = {
        id: 'user-1',
        guild: { id: 'guild-1', ownerId: 'other' },
        roles: { cache: new Map() },
        permissions: new PermissionsBitField(0n),
      } as unknown as GuildMember;

      const res = await service.createRole(mockMember, 'Role 2', '#123456');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Você já possui um cargo personalizado');
    });

    it('should create role with exactly 0 permissions (0n)', async () => {
      mockRepo.getConfig.mockResolvedValue({
        enabled: true,
        allowedRoleIds: [],
        anchorRoleId: null,
      });
      mockRepo.findByUser.mockResolvedValue(null);
      mockRepo.createCustomRole.mockResolvedValue({
        id: 'cr-1',
        guildId: 'guild-1',
        userId: 'user-1',
        roleId: 'role-new',
        name: 'Diamante',
        color: '#00FFFF',
      });

      const mockCreatedRole = {
        id: 'role-new',
        setPosition: vi.fn(),
      } as unknown as Role;

      const mockGuild = {
        id: 'guild-1',
        ownerId: 'user-1',
        roles: {
          create: vi.fn().mockResolvedValue(mockCreatedRole),
        },
        members: {
          me: {
            permissions: new PermissionsBitField(PermissionFlagsBits.ManageRoles),
            roles: { highest: { position: 10 } },
          },
        },
      } as unknown as Guild;

      const mockMember = {
        id: 'user-1',
        guild: mockGuild,
        user: { tag: 'User#0001' },
        roles: {
          cache: new Map(),
          add: vi.fn().mockResolvedValue({}),
        },
        permissions: new PermissionsBitField(PermissionFlagsBits.Administrator),
      } as unknown as GuildMember;

      const res = await service.createRole(mockMember, 'Diamante', '#00FFFF');
      expect(res.success).toBe(true);
      expect(mockGuild.roles.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Diamante',
          permissions: 0n, // Exactly zero permissions
        }),
      );
      expect(mockCreatedRole.setPosition).toHaveBeenCalledWith(9, {
        relative: false,
        reason: 'CoreBot: Posicionamento hierárquico do cargo personalizado',
      });
    });
  });
});
