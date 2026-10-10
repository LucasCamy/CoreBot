import {
  ActionRowBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  VoiceChannel,
} from 'discord.js';
import {
  ButtonContext,
  IButtonHandler,
  IModalHandler,
  ISelectMenuHandler,
  ModalContext,
  SelectMenuContext,
} from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { VoiceHubService } from '../services/voice-hub.service.js';

// ==========================================
// Button: Trancar / Destrancar
// ==========================================
export const voiceHubToggleLockButton: IButtonHandler = {
  customIdPrefix: 'voice_hub_toggle_lock:',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const { interaction, container, member, guild } = ctx;
    const channelId = interaction.customId.replace('voice_hub_toggle_lock:', '');
    const service = new VoiceHubService(container);

    const isAuthorized = await service.isChannelOwnerOrAdmin(channelId, member);
    if (!isAuthorized) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Não Autorizado', 'Apenas o criador da sala pode gerenciar este canal.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const channel = (await guild.channels
      .fetch(channelId)
      .catch(() => null)) as VoiceChannel | null;
    if (!channel) {
      await interaction.reply({ embeds: [BotEmbed.error('Canal Inexistente')], ephemeral: true });
      return;
    }

    const activeRecord = await container.voiceHubRepository.findActiveChannel(channelId);
    const currentlyLocked = activeRecord
      ? activeRecord.isLocked
      : !channel.permissionsFor(guild.roles.everyone).has(PermissionFlagsBits.Connect);

    if (currentlyLocked) {
      // Unlock: Allow everyone to connect
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        Connect: null,
        ViewChannel: true,
      });

      const currentName = channel.name;
      const newName = currentName.startsWith('🔒')
        ? currentName.replace(/^🔒\s*/, '🔊 ')
        : currentName;
      if (newName !== currentName) {
        await channel.setName(newName).catch(() => null);
      }

      await container.voiceHubRepository.setChannelLock(channelId, false);

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Canal Destrancado',
            'A sala agora é **pública** e outros membros podem entrar livremente.',
          ),
        ],
        ephemeral: true,
      });
    } else {
      // Lock: Deny everyone from connecting
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        Connect: false,
        ViewChannel: true,
      });

      const currentName = channel.name;
      const newName = currentName.startsWith('🔊')
        ? currentName.replace(/^🔊\s*/, '🔒 ')
        : currentName.startsWith('🔒')
          ? currentName
          : `🔒 ${currentName}`;
      if (newName !== currentName) {
        await channel.setName(newName).catch(() => null);
      }

      await container.voiceHubRepository.setChannelLock(channelId, true);

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Canal Trancado',
            'A sala agora é **privada**. Utilize o botão **Convidar Amigo** para liberar membros específicos.',
          ),
        ],
        ephemeral: true,
      });
    }
  },
};

// ==========================================
// Button: Convidar Amigo
// ==========================================
export const voiceHubInviteButton: IButtonHandler = {
  customIdPrefix: 'voice_hub_btn_invite:',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const { interaction, container, member } = ctx;
    const channelId = interaction.customId.replace('voice_hub_btn_invite:', '');
    const service = new VoiceHubService(container);

    const isAuthorized = await service.isChannelOwnerOrAdmin(channelId, member);
    if (!isAuthorized) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Não Autorizado', 'Apenas o criador da sala pode gerenciar este canal.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId(`voice_hub_select_invite:${channelId}`)
      .setPlaceholder('Selecione os amigos para permitir na sala privada')
      .setMinValues(1)
      .setMaxValues(10);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content: '➕ Escolha os amigos que terão passe livre nesta sala:',
      components: [row],
      ephemeral: true,
    });
  },
};

// ==========================================
// SelectMenu: Convidar Amigo (Execução)
// ==========================================
export const voiceHubSelectInviteHandler: ISelectMenuHandler = {
  customIdPrefix: 'voice_hub_select_invite:',
  execute: async (ctx: SelectMenuContext): Promise<void> => {
    const { interaction, container, member, guild } = ctx;
    const channelId = interaction.customId.replace('voice_hub_select_invite:', '');
    const service = new VoiceHubService(container);

    const isAuthorized = await service.isChannelOwnerOrAdmin(channelId, member);
    if (!isAuthorized) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Não Autorizado', 'Apenas o criador da sala pode gerenciar este canal.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const channel = (await guild.channels
      .fetch(channelId)
      .catch(() => null)) as VoiceChannel | null;
    if (!channel) {
      await interaction.reply({ embeds: [BotEmbed.error('Canal Inexistente')], ephemeral: true });
      return;
    }

    const userIds = interaction.values;
    for (const userId of userIds) {
      await channel.permissionOverwrites.edit(userId, {
        Connect: true,
        ViewChannel: true,
      });
      await container.voiceHubRepository.addWhitelistedUser(channelId, userId);
    }

    const mentions = userIds.map((id) => `<@${id}>`).join(', ');
    await interaction.update({
      content: `✅ Amigos convidados com sucesso!\nOs seguintes membros agora podem conectar na sala: ${mentions}`,
      components: [],
    });
  },
};

// ==========================================
// Button: Expulsar
// ==========================================
export const voiceHubKickButton: IButtonHandler = {
  customIdPrefix: 'voice_hub_btn_kick:',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const { interaction, container, member } = ctx;
    const channelId = interaction.customId.replace('voice_hub_btn_kick:', '');
    const service = new VoiceHubService(container);

    const isAuthorized = await service.isChannelOwnerOrAdmin(channelId, member);
    if (!isAuthorized) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Não Autorizado', 'Apenas o criador da sala pode gerenciar este canal.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId(`voice_hub_select_kick:${channelId}`)
      .setPlaceholder('Selecione o membro para expulsar e bloquear')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content: '🚫 Selecione quem deseja expulsar e bloquear da sala:',
      components: [row],
      ephemeral: true,
    });
  },
};

// ==========================================
// SelectMenu: Expulsar (Execução)
// ==========================================
export const voiceHubSelectKickHandler: ISelectMenuHandler = {
  customIdPrefix: 'voice_hub_select_kick:',
  execute: async (ctx: SelectMenuContext): Promise<void> => {
    const { interaction, container, member, guild } = ctx;
    const channelId = interaction.customId.replace('voice_hub_select_kick:', '');
    const service = new VoiceHubService(container);

    const isAuthorized = await service.isChannelOwnerOrAdmin(channelId, member);
    if (!isAuthorized) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Não Autorizado', 'Apenas o criador da sala pode gerenciar este canal.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const targetUserId = interaction.values[0];
    if (targetUserId === member.id) {
      await interaction.reply({
        embeds: [BotEmbed.error('Ação Inválida', 'Você não pode expulsar a si mesmo da sala.')],
        ephemeral: true,
      });
      return;
    }

    const channel = (await guild.channels
      .fetch(channelId)
      .catch(() => null)) as VoiceChannel | null;
    if (!channel) {
      await interaction.reply({ embeds: [BotEmbed.error('Canal Inexistente')], ephemeral: true });
      return;
    }

    // Deny connect permission explicitly
    await channel.permissionOverwrites.edit(targetUserId, {
      Connect: false,
    });

    await container.voiceHubRepository.removeWhitelistedUser(channelId, targetUserId);

    // If currently connected in this channel, disconnect them
    const targetMember = channel.members.get(targetUserId);
    if (targetMember) {
      await targetMember.voice.disconnect('Expulso pelo dono da sala temporária').catch(() => null);
    }

    await interaction.update({
      content: `🚫 <@${targetUserId}> foi expulso e bloqueado de entrar nesta sala temporária.`,
      components: [],
    });
  },
};

// ==========================================
// Button: Definir Limite
// ==========================================
export const voiceHubSetLimitButton: IButtonHandler = {
  customIdPrefix: 'voice_hub_set_limit:',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const { interaction, container, member } = ctx;
    const channelId = interaction.customId.replace('voice_hub_set_limit:', '');
    const service = new VoiceHubService(container);

    const isAuthorized = await service.isChannelOwnerOrAdmin(channelId, member);
    if (!isAuthorized) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Não Autorizado', 'Apenas o criador da sala pode gerenciar este canal.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`voice_hub_modal_limit:${channelId}`)
      .setTitle('Limite de Membros da Sala');

    const input = new TextInputBuilder()
      .setCustomId('novo_limite')
      .setLabel('Novo limite de usuários (0 = Ilimitado)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 5 (entre 0 e 99)')
      .setMaxLength(2)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
  },
};

// ==========================================
// Modal: Definir Limite (Execução)
// ==========================================
export const voiceHubLimitModalHandler: IModalHandler = {
  customIdPrefix: 'voice_hub_modal_limit:',
  execute: async (ctx: ModalContext): Promise<void> => {
    const { interaction, guild } = ctx;
    const channelId = interaction.customId.replace('voice_hub_modal_limit:', '');
    const limitRaw = interaction.fields.getTextInputValue('novo_limite');
    const limit = parseInt(limitRaw, 10);

    if (isNaN(limit) || limit < 0 || limit > 99) {
      await interaction.reply({
        embeds: [BotEmbed.error('Valor Inválido', 'O limite deve ser um número entre 0 e 99.')],
        ephemeral: true,
      });
      return;
    }

    const channel = (await guild.channels
      .fetch(channelId)
      .catch(() => null)) as VoiceChannel | null;
    if (!channel) {
      await interaction.reply({ embeds: [BotEmbed.error('Canal Inexistente')], ephemeral: true });
      return;
    }

    await channel.setUserLimit(limit);
    await interaction.reply({
      embeds: [
        BotEmbed.success(
          'Limite Atualizado',
          `O limite desta sala foi alterado para **${limit === 0 ? 'Ilimitado' : `${limit} membros`}**.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

// ==========================================
// Button: Renomear Sala
// ==========================================
export const voiceHubRenameButton: IButtonHandler = {
  customIdPrefix: 'voice_hub_btn_rename:',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const { interaction, container, member } = ctx;
    const channelId = interaction.customId.replace('voice_hub_btn_rename:', '');
    const service = new VoiceHubService(container);

    const isAuthorized = await service.isChannelOwnerOrAdmin(channelId, member);
    if (!isAuthorized) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Não Autorizado', 'Apenas o criador da sala pode gerenciar este canal.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`voice_hub_modal_rename:${channelId}`)
      .setTitle('Renomear Sala');

    const input = new TextInputBuilder()
      .setCustomId('novo_nome')
      .setLabel('Novo nome para a sala')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Jogatina dos Amigos')
      .setMaxLength(30)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
  },
};

// ==========================================
// Modal: Renomear Sala (Execução)
// ==========================================
export const voiceHubRenameModalHandler: IModalHandler = {
  customIdPrefix: 'voice_hub_modal_rename:',
  execute: async (ctx: ModalContext): Promise<void> => {
    const { interaction, container, guild } = ctx;
    const channelId = interaction.customId.replace('voice_hub_modal_rename:', '');
    const newNameRaw = interaction.fields.getTextInputValue('novo_nome').trim();

    if (!newNameRaw) {
      await interaction.reply({
        embeds: [BotEmbed.error('Nome Inválido', 'O nome da sala não pode estar vazio.')],
        ephemeral: true,
      });
      return;
    }

    const channel = (await guild.channels
      .fetch(channelId)
      .catch(() => null)) as VoiceChannel | null;
    if (!channel) {
      await interaction.reply({ embeds: [BotEmbed.error('Canal Inexistente')], ephemeral: true });
      return;
    }

    const activeRecord = await container.voiceHubRepository.findActiveChannel(channelId);
    const prefix = activeRecord?.isLocked ? '🔒 ' : '🔊 ';
    const formattedName =
      newNameRaw.startsWith('🔒') || newNameRaw.startsWith('🔊')
        ? newNameRaw
        : `${prefix}${newNameRaw}`;

    await channel.setName(formattedName);

    await interaction.reply({
      embeds: [
        BotEmbed.success(
          'Sala Renomeada',
          `O nome da sala foi alterado para **${formattedName}**.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

// ==========================================
// Button: Passar Liderança
// ==========================================
export const voiceHubTransferOwnerButton: IButtonHandler = {
  customIdPrefix: 'voice_hub_transfer_owner:',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const { interaction, container, member } = ctx;
    const channelId = interaction.customId.replace('voice_hub_transfer_owner:', '');
    const service = new VoiceHubService(container);

    const isAuthorized = await service.isChannelOwnerOrAdmin(channelId, member);
    if (!isAuthorized) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Não Autorizado', 'Apenas o criador da sala pode gerenciar este canal.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId(`voice_hub_select_owner:${channelId}`)
      .setPlaceholder('Selecione o novo líder do canal de voz')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content: '👑 Escolha o membro para assumir o controle desta sala:',
      components: [row],
      ephemeral: true,
    });
  },
};

// ==========================================
// SelectMenu: Passar Liderança (Execução)
// ==========================================
export const voiceHubSelectOwnerHandler: ISelectMenuHandler = {
  customIdPrefix: 'voice_hub_select_owner:',
  execute: async (ctx: SelectMenuContext): Promise<void> => {
    const { interaction, container, guild } = ctx;
    const channelId = interaction.customId.replace('voice_hub_select_owner:', '');
    const selectedUserId = interaction.values[0];

    const channel = (await guild.channels
      .fetch(channelId)
      .catch(() => null)) as VoiceChannel | null;
    if (!channel) {
      await interaction.reply({ embeds: [BotEmbed.error('Canal Inexistente')], ephemeral: true });
      return;
    }

    const newOwnerMember = await guild.members.fetch(selectedUserId).catch(() => null);
    if (!newOwnerMember || newOwnerMember.user.bot) {
      await interaction.reply({
        embeds: [
          BotEmbed.error(
            'Seleção Inválida',
            'Não é possível transferir a liderança para bots ou membros indisponíveis.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // Update database
    await container.voiceHubRepository.updateActiveChannelOwner(channelId, newOwnerMember.id);

    // Update Discord permission overwrites
    await channel.permissionOverwrites.edit(newOwnerMember.id, {
      Connect: true,
      Speak: true,
      Stream: true,
      UseVAD: true,
    });

    await channel.send({
      embeds: [
        BotEmbed.info(
          '👑 Nova Liderança da Sala',
          `A liderança desta sala foi transferida para <@${newOwnerMember.id}>!`,
        ),
      ],
    });

    await interaction.update({
      content: `✅ Liderança transferida com sucesso para <@${newOwnerMember.id}>!`,
      components: [],
    });
  },
};
