import { Guild, GuildMember, TextChannel, NewsChannel } from 'discord.js';
import { Container } from '../../../core/container.js';
import { GuildGuard } from '../../../discord/guards/guild.guard.js';
import { logger } from '../../../utils/logger.js';
import {
  UpdateBoostConfigInput,
  updateBoostConfigSchema,
  UpdateWelcomeConfigInput,
  updateWelcomeConfigSchema,
} from '../schemas/system-messages.schema.js';
import { SystemMessageConfig } from '@prisma/client';

export class SystemMessagesService {
  constructor(private readonly container: Container) {}

  public async getConfig(guildId: string): Promise<SystemMessageConfig | null> {
    return this.container.systemMessagesRepository.getConfig(guildId);
  }

  public async updateWelcomeConfig(
    guildId: string,
    input: UpdateWelcomeConfigInput,
  ): Promise<SystemMessageConfig> {
    const validated = updateWelcomeConfigSchema.parse(input);
    return this.container.systemMessagesRepository.upsertConfig(guildId, validated);
  }

  public async updateBoostConfig(
    guildId: string,
    input: UpdateBoostConfigInput,
  ): Promise<SystemMessageConfig> {
    const validated = updateBoostConfigSchema.parse(input);
    return this.container.systemMessagesRepository.upsertConfig(guildId, validated);
  }

  public async handleWelcome(member: GuildMember): Promise<void> {
    try {
      if (!member?.guild?.id) return;
      if (!GuildGuard.isAllowed(member.guild.id)) return;

      const config = await this.getConfig(member.guild.id);
      if (!config || !config.welcomeEnabled || !config.welcomeChannelId) {
        return;
      }

      const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel)) {
        logger.warn(
          { guildId: member.guild.id, channelId: config.welcomeChannelId },
          'Welcome notification channel not found or not text-based',
        );
        return;
      }

      const context = {
        user: member.displayName || member.user.username,
        userMention: `<@${member.id}>`,
        username: member.user.username,
        server: member.guild.name,
        memberCount: member.guild.memberCount,
      };

      const rendered = this.container.templateService.renderMessage(
        config.welcomeMessage,
        context,
        {
          useEmbed: config.welcomeUseEmbed,
          embedColor: config.welcomeColor || '#5865F2',
          embedTitle: `👋 Bem-vindo(a) ao ${member.guild.name}!`,
        },
      );

      if (config.welcomeUseEmbed && rendered.embeds?.[0]) {
        rendered.embeds[0].setThumbnail(member.user.displayAvatarURL({ size: 256 }));
        rendered.embeds[0].setFooter({
          text: `Membro #${member.guild.memberCount}`,
          iconURL: member.guild.iconURL() ?? undefined,
        });
      }

      await this.container.notificationService.sendToChannel({
        guildId: member.guild.id,
        module: 'system-messages',
        eventType: 'WELCOME',
        channelId: config.welcomeChannelId,
        content: rendered.content,
        embeds: rendered.embeds,
        deduplicationKey: `welcome:${member.guild.id}:${member.id}`,
      });

      logger.info(
        { guildId: member.guild.id, userId: member.id, channelId: config.welcomeChannelId },
        'Dispatched welcome system message',
      );
    } catch (error) {
      logger.error(
        { guildId: member?.guild?.id, userId: member?.id, error },
        'Failed to handle welcome system message',
      );
    }
  }

  public async handleBoost(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    try {
      if (!newMember?.guild?.id) return;
      if (!GuildGuard.isAllowed(newMember.guild.id)) return;

      const wasBoosting = Boolean(oldMember.premiumSince);
      const isBoosting = Boolean(newMember.premiumSince);
      const timestampChanged = Boolean(
        oldMember.premiumSince &&
        newMember.premiumSince &&
        oldMember.premiumSince.getTime() !== newMember.premiumSince.getTime(),
      );

      const justBoosted = (!wasBoosting && isBoosting) || timestampChanged;
      if (!justBoosted) {
        return;
      }

      const config = await this.getConfig(newMember.guild.id);
      if (!config || !config.boostEnabled || !config.boostChannelId) {
        return;
      }

      const channel = await newMember.guild.channels.fetch(config.boostChannelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel)) {
        logger.warn(
          { guildId: newMember.guild.id, channelId: config.boostChannelId },
          'Boost notification channel not found or not text-based',
        );
        return;
      }

      const context = {
        user: newMember.displayName || newMember.user.username,
        userMention: `<@${newMember.id}>`,
        username: newMember.user.username,
        server: newMember.guild.name,
        memberCount: newMember.guild.memberCount,
        boostCount: newMember.guild.premiumSubscriptionCount ?? 0,
        boostTier: newMember.guild.premiumTier,
      };

      const rendered = this.container.templateService.renderMessage(config.boostMessage, context, {
        useEmbed: config.boostUseEmbed,
        embedColor: config.boostColor || '#F47FFF',
        embedTitle: `🚀 Novo Impulso no Servidor!`,
      });

      if (config.boostUseEmbed && rendered.embeds?.[0]) {
        rendered.embeds[0].setThumbnail(newMember.user.displayAvatarURL({ size: 256 }));
        rendered.embeds[0].setFooter({
          text: `${newMember.guild.name} • ${newMember.guild.premiumSubscriptionCount ?? 0} impulsos`,
          iconURL: newMember.guild.iconURL() ?? undefined,
        });
      }

      await this.container.notificationService.sendToChannel({
        guildId: newMember.guild.id,
        module: 'system-messages',
        eventType: 'BOOST',
        channelId: config.boostChannelId,
        content: rendered.content,
        embeds: rendered.embeds,
        deduplicationKey: `boost:${newMember.guild.id}:${newMember.id}:${Date.now()}`,
      });

      logger.info(
        { guildId: newMember.guild.id, userId: newMember.id, channelId: config.boostChannelId },
        'Dispatched boost system message',
      );
    } catch (error) {
      logger.error(
        { guildId: newMember?.guild?.id, userId: newMember?.id, error },
        'Failed to handle boost system message',
      );
    }
  }

  public async sendTestMessage(
    guild: Guild,
    member: GuildMember,
    type: 'boas-vindas' | 'boost',
  ): Promise<{ success: boolean; channelId?: string; error?: string }> {
    try {
      const config = await this.getConfig(guild.id);
      const isWelcome = type === 'boas-vindas';
      const channelId = isWelcome ? config?.welcomeChannelId : config?.boostChannelId;

      if (!channelId) {
        return {
          success: false,
          error: `Nenhum canal de texto configurado para ${isWelcome ? 'boas-vindas' : 'boost'}. Use \`/mensagens-sistema ${type} canal:#canal\` primeiro.`,
        };
      }

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel)) {
        return {
          success: false,
          error: `O canal configurado (<#${channelId}>) não foi encontrado ou o bot não tem acesso a ele.`,
        };
      }

      const context = {
        user: member.displayName || member.user.username,
        userMention: `<@${member.id}>`,
        username: member.user.username,
        server: guild.name,
        memberCount: guild.memberCount,
        boostCount: guild.premiumSubscriptionCount ?? 0,
        boostTier: guild.premiumTier,
      };

      const template = isWelcome
        ? config?.welcomeMessage ||
          '👋 Seja bem-vindo(a) ao **{server}**, {userMention}! Agora somos **{memberCount}** membros.'
        : config?.boostMessage ||
          '🚀 **{userMention}** acabou de impulsionar o servidor! Muito obrigado pelo apoio! O **{server}** agora conta com **{boostCount}** impulsos. 🎉';

      const useEmbed = isWelcome
        ? (config?.welcomeUseEmbed ?? true)
        : (config?.boostUseEmbed ?? true);
      const color = isWelcome ? config?.welcomeColor || '#5865F2' : config?.boostColor || '#F47FFF';

      const rendered = this.container.templateService.renderMessage(template, context, {
        useEmbed,
        embedColor: color,
        embedTitle: isWelcome
          ? `👋 Bem-vindo(a) ao ${guild.name}! (Teste)`
          : `🚀 Novo Impulso no Servidor! (Teste)`,
      });

      if (useEmbed && rendered.embeds?.[0]) {
        rendered.embeds[0].setThumbnail(member.user.displayAvatarURL({ size: 256 }));
        rendered.embeds[0].setFooter({
          text: isWelcome
            ? `Membro #${guild.memberCount} • Simulação de Teste`
            : `${guild.name} • ${guild.premiumSubscriptionCount ?? 0} impulsos • Simulação de Teste`,
          iconURL: guild.iconURL() ?? undefined,
        });
      }

      await this.container.notificationService.sendToChannel({
        guildId: guild.id,
        module: 'system-messages',
        eventType: isWelcome ? 'WELCOME_TEST' : 'BOOST_TEST',
        channelId,
        content: rendered.content,
        embeds: rendered.embeds,
      });

      return { success: true, channelId };
    } catch (error) {
      logger.error({ guildId: guild.id, type, error }, 'Error sending system message test');
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Erro interno ao disparar mensagem de teste.',
      };
    }
  }
}
