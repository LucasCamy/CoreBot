import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { voiceConfigSchema } from '../schemas/voice.schema.js';
import { VoiceNotificationService } from '../services/voice-notify.service.js';

export const voiceNotifyCommand: ICommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('voz-notificar')
    .setDescription('Gerencia notificações de entrada e saída em canais de voz')
    // Subcommand: configurar
    .addSubcommand((sub) =>
      sub
        .setName('configurar')
        .setDescription('Configura notificações para um canal de voz')
        .addChannelOption((opt) =>
          opt
            .setName('canal_voz')
            .setDescription('Canal de voz monitorado')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal_texto')
            .setDescription('Canal de texto de destino para os avisos')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('msg_entrada')
            .setDescription('Mensagem de entrada ({userMention}, {channelMention})'),
        )
        .addStringOption((opt) =>
          opt
            .setName('msg_saida')
            .setDescription('Mensagem de saída ({userMention}, {channelMention})'),
        )
        .addStringOption((opt) =>
          opt.setName('msg_troca').setDescription('Mensagem de troca de canal'),
        )
        .addBooleanOption((opt) =>
          opt.setName('mencionar').setDescription('Mencionar o usuário na mensagem? (Padrão: sim)'),
        )
        .addBooleanOption((opt) =>
          opt.setName('usar_embed').setDescription('Enviar em formato embed estilizado?'),
        )
        .addStringOption((opt) =>
          opt.setName('cor_embed').setDescription('Cor hex do embed (ex: #5865F2)'),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('cooldown')
            .setDescription('Tempo de cooldown em segundos para evitar spam (Padrão: 10)'),
        ),
    )
    // Subcommand: listar
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista todas as configurações ativas de canais de voz'),
    )
    // Subcommand: editar
    .addSubcommand((sub) =>
      sub
        .setName('editar')
        .setDescription('Edita as configurações de um canal monitorado existente')
        .addChannelOption((opt) =>
          opt
            .setName('canal_voz')
            .setDescription('Canal de voz a ser editado')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal_texto')
            .setDescription('Novo canal de texto de destino')
            .addChannelTypes(ChannelType.GuildText),
        )
        .addBooleanOption((opt) =>
          opt.setName('ativo').setDescription('Ativar ou desativar temporariamente'),
        )
        .addStringOption((opt) =>
          opt.setName('msg_entrada').setDescription('Nova mensagem de entrada'),
        )
        .addStringOption((opt) => opt.setName('msg_saida').setDescription('Nova mensagem de saída'))
        .addBooleanOption((opt) => opt.setName('mencionar').setDescription('Mencionar usuário?'))
        .addBooleanOption((opt) => opt.setName('usar_embed').setDescription('Usar formato Embed?')),
    )
    // Subcommand: remover
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove o monitoramento de um canal de voz')
        .addChannelOption((opt) =>
          opt
            .setName('canal_voz')
            .setDescription('Canal de voz a desvincular')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        ),
    )
    // Subcommand: testar
    .addSubcommand((sub) =>
      sub
        .setName('testar')
        .setDescription('Testa o envio de uma notificação simulada')
        .addChannelOption((opt) =>
          opt
            .setName('canal_voz')
            .setDescription('Canal de voz configurado para teste')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('tipo')
            .setDescription('Tipo de notificação para testar')
            .setRequired(true)
            .addChoices(
              { name: 'Entrada (Join)', value: 'join' },
              { name: 'Saída (Leave)', value: 'leave' },
              { name: 'Troca de Canal (Move)', value: 'move' },
            ),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, guildId, member } = ctx;
    const voiceRepo = container.voiceRepository;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'configurar') {
      const voiceChannel = interaction.options.getChannel('canal_voz', true);
      const textChannel = interaction.options.getChannel('canal_texto', true);
      const joinMsg = interaction.options.getString('msg_entrada');
      const leaveMsg = interaction.options.getString('msg_saida');
      const moveMsg = interaction.options.getString('msg_troca');
      const mention = interaction.options.getBoolean('mencionar') ?? true;
      const embed = interaction.options.getBoolean('usar_embed') ?? false;
      const color = interaction.options.getString('cor_embed') ?? '#5865F2';
      const cooldown = interaction.options.getInteger('cooldown') ?? 10;

      const parsed = voiceConfigSchema.safeParse({
        guildId,
        voiceChannelId: voiceChannel.id,
        targetChannelId: textChannel.id,
        joinMessage: joinMsg ?? undefined,
        leaveMessage: leaveMsg ?? undefined,
        moveMessage: moveMsg ?? undefined,
        mentionUser: mention,
        useEmbed: embed,
        embedColor: color,
        cooldownSeconds: cooldown,
      });

      if (!parsed.success) {
        await interaction.reply({
          embeds: [BotEmbed.error('Configuração Inválida', parsed.error.errors[0].message)],
          ephemeral: true,
        });
        return;
      }

      await voiceRepo.upsert(parsed.data);

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Canal de Voz Configurado!',
            `Canal de Voz: <#${voiceChannel.id}>\nDestino das Notificações: <#${textChannel.id}>\nFormato: ${embed ? 'Embed' : 'Texto Simples'}\nMencionar Usuário: ${mention ? 'Sim' : 'Não'}\nCooldown: ${cooldown}s`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'listar') {
      const configs = await voiceRepo.listByGuild(guildId);
      if (configs.length === 0) {
        await interaction.reply({
          embeds: [
            BotEmbed.info(
              'Nenhuma Configuração',
              'Não há canais de voz configurados para monitoramento neste servidor.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const desc = configs
        .map(
          (c, idx) =>
            `**${idx + 1}.** Voz: <#${c.voiceChannelId}> ➡️ Texto: <#${c.targetChannelId}> | Status: ${c.enabled ? '🟢 Ativo' : '🔴 Inativo'} | Embed: ${c.useEmbed ? 'Sim' : 'Não'}`,
        )
        .join('\n');

      await interaction.reply({
        embeds: [BotEmbed.info('Canais de Voz Monitorados', desc)],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'editar') {
      const voiceChannel = interaction.options.getChannel('canal_voz', true);
      const existing = await voiceRepo.findByChannel(guildId, voiceChannel.id);

      if (!existing) {
        await interaction.reply({
          embeds: [
            BotEmbed.error('Não Encontrado', 'Este canal de voz não possui configurações salvas.'),
          ],
          ephemeral: true,
        });
        return;
      }

      const textChannel = interaction.options.getChannel('canal_texto');
      const active = interaction.options.getBoolean('ativo');
      const joinMsg = interaction.options.getString('msg_entrada');
      const leaveMsg = interaction.options.getString('msg_saida');
      const mention = interaction.options.getBoolean('mencionar');
      const embed = interaction.options.getBoolean('usar_embed');

      await voiceRepo.upsert({
        guildId,
        voiceChannelId: voiceChannel.id,
        targetChannelId: textChannel?.id ?? existing.targetChannelId,
        enabled: active ?? existing.enabled,
        joinMessage: joinMsg ?? existing.joinMessage,
        leaveMessage: leaveMsg ?? existing.leaveMessage,
        mentionUser: mention ?? existing.mentionUser,
        useEmbed: embed ?? existing.useEmbed,
      });

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Configuração Atualizada',
            `As configurações para <#${voiceChannel.id}> foram atualizadas com sucesso.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'remover') {
      const voiceChannel = interaction.options.getChannel('canal_voz', true);
      const deleted = await voiceRepo.delete(guildId, voiceChannel.id);

      if (!deleted) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrado', 'Este canal de voz não estava configurado.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Removido',
            `O monitoramento de <#${voiceChannel.id}> foi removido com sucesso.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'testar') {
      const voiceChannel = interaction.options.getChannel('canal_voz', true);
      const type = interaction.options.getString('tipo', true) as 'join' | 'leave' | 'move';

      const config = await voiceRepo.findByChannel(guildId, voiceChannel.id);
      if (!config) {
        await interaction.reply({
          embeds: [
            BotEmbed.error(
              'Não Configurado',
              'Configure este canal de voz antes de realizar um teste.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const service = new VoiceNotificationService(container);
      await service.dispatchNotification(config, member, voiceChannel.id, type);

      await interaction.editReply({
        embeds: [
          BotEmbed.success(
            'Teste Enviado!',
            `Uma notificação de teste do tipo **${type}** foi despachada para o canal <#${config.targetChannelId}>.`,
          ),
        ],
      });
    }
  },
};
