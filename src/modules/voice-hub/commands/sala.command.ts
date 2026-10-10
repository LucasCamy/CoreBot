import { PermissionFlagsBits, SlashCommandBuilder, VoiceChannel } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { PermissionGuard } from '../../../discord/guards/permission.guard.js';

export const salaCommand: ICommand = {
  adminOnly: false,
  data: new SlashCommandBuilder()
    .setName('sala')
    .setDescription('Gerencia a sua sala de voz temporária atual')
    // Subcommand: trancar
    .addSubcommand((sub) =>
      sub.setName('trancar').setDescription('Tranca a sala atual (torna-a privada)'),
    )
    // Subcommand: destrancar
    .addSubcommand((sub) =>
      sub.setName('destrancar').setDescription('Destranca a sala atual (torna-a pública)'),
    )
    // Subcommand: convidar
    .addSubcommand((sub) =>
      sub
        .setName('convidar')
        .setDescription('Permite a entrada de um amigo na sua sala privada')
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('Membro que terá acesso liberado')
            .setRequired(true),
        ),
    )
    // Subcommand: expulsar
    .addSubcommand((sub) =>
      sub
        .setName('expulsar')
        .setDescription('Expulsa e bloqueia um usuário da sua sala temporária')
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('Membro a ser desconectado e bloqueado')
            .setRequired(true),
        ),
    )
    // Subcommand: limite
    .addSubcommand((sub) =>
      sub
        .setName('limite')
        .setDescription('Define o limite máximo de usuários na sala (0 = ilimitado)')
        .addIntegerOption((opt) =>
          opt
            .setName('numero')
            .setDescription('Capacidade máxima (0 a 99)')
            .setMinValue(0)
            .setMaxValue(99)
            .setRequired(true),
        ),
    )
    // Subcommand: renomear
    .addSubcommand((sub) =>
      sub
        .setName('renomear')
        .setDescription('Altera o nome da sua sala de voz temporária')
        .addStringOption((opt) =>
          opt
            .setName('novo_nome')
            .setDescription('Novo nome para a sala (máx: 30 caracteres)')
            .setMaxLength(30)
            .setRequired(true),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, member, guild } = ctx;
    const subcommand = interaction.options.getSubcommand();

    const voiceChannel = member.voice.channel as VoiceChannel | null;
    if (!voiceChannel) {
      await interaction.reply({
        embeds: [
          BotEmbed.error(
            'Fora da Sala',
            'Você precisa estar conectado em um canal de voz temporário para usar este comando.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const activeRecord = await container.voiceHubRepository.findActiveChannel(voiceChannel.id);
    if (!activeRecord) {
      await interaction.reply({
        embeds: [
          BotEmbed.error(
            'Canal Inválido',
            'Este canal de voz não é uma sala dinâmica temporária gerenciada pelo bot.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const isBotAdmin = await PermissionGuard.isAdmin(member, container);
    const isOwner =
      activeRecord.ownerId === member.id ||
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      isBotAdmin;

    if (!isOwner) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Não Autorizado', 'Apenas o criador da sala pode gerenciar este canal.'),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'trancar') {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, {
        Connect: false,
        ViewChannel: true,
      });

      const currentName = voiceChannel.name;
      const newName = currentName.startsWith('🔊')
        ? currentName.replace(/^🔊\s*/, '🔒 ')
        : currentName.startsWith('🔒')
          ? currentName
          : `🔒 ${currentName}`;
      if (newName !== currentName) {
        await voiceChannel.setName(newName).catch(() => null);
      }

      await container.voiceHubRepository.setChannelLock(voiceChannel.id, true);

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Sala Trancada',
            'A sala agora é **privada**. Utilize `/sala convidar` para liberar membros específicos.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'destrancar') {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, {
        Connect: null,
        ViewChannel: true,
      });

      const currentName = voiceChannel.name;
      const newName = currentName.startsWith('🔒')
        ? currentName.replace(/^🔒\s*/, '🔊 ')
        : currentName;
      if (newName !== currentName) {
        await voiceChannel.setName(newName).catch(() => null);
      }

      await container.voiceHubRepository.setChannelLock(voiceChannel.id, false);

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Sala Destrancada',
            'A sala agora é **pública** e outros membros podem entrar livremente.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'convidar') {
      const targetUser = interaction.options.getUser('usuario', true);

      await voiceChannel.permissionOverwrites.edit(targetUser.id, {
        Connect: true,
        ViewChannel: true,
      });

      await container.voiceHubRepository.addWhitelistedUser(voiceChannel.id, targetUser.id);

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Membro Convidado',
            `✅ <@${targetUser.id}> agora tem permissão para conectar nesta sala privada!`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'expulsar') {
      const targetUser = interaction.options.getUser('usuario', true);

      if (targetUser.id === member.id) {
        await interaction.reply({
          embeds: [BotEmbed.error('Ação Inválida', 'Você não pode expulsar a si mesmo da sala.')],
          ephemeral: true,
        });
        return;
      }

      await voiceChannel.permissionOverwrites.edit(targetUser.id, {
        Connect: false,
      });

      await container.voiceHubRepository.removeWhitelistedUser(voiceChannel.id, targetUser.id);

      const targetMember = voiceChannel.members.get(targetUser.id);
      if (targetMember) {
        await targetMember.voice
          .disconnect('Expulso pelo dono da sala temporária')
          .catch(() => null);
      }

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Membro Expulso',
            `🚫 <@${targetUser.id}> foi desconectado e bloqueado de entrar nesta sala temporária.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'limite') {
      const limit = interaction.options.getInteger('numero', true);

      await voiceChannel.setUserLimit(limit);

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Limite Atualizado',
            `O limite desta sala foi alterado para **${limit === 0 ? 'Ilimitado' : `${limit} membros`}**.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'renomear') {
      const rawName = interaction.options.getString('novo_nome', true).trim();

      const prefix = activeRecord.isLocked ? '🔒 ' : '🔊 ';
      const formattedName =
        rawName.startsWith('🔒') || rawName.startsWith('🔊') ? rawName : `${prefix}${rawName}`;

      await voiceChannel.setName(formattedName);

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Sala Renomeada',
            `O nome da sala foi alterado para **${formattedName}**.`,
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
