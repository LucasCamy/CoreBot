import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { voiceConfigSchema, VoiceRuleEventType } from '../schemas/voice.schema.js';
import { VoiceNotificationService } from '../services/voice-notify.service.js';

export const voiceNotifyCommand: ICommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('voz-notificar')
    .setDescription('Gerencia regras e notificações de entrada e saída em canais de voz')
    // Subcommand: adicionar
    .addSubcommand((sub) =>
      sub
        .setName('adicionar')
        .setDescription('Adiciona uma regra de notificação para um canal de voz')
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
            .setName('tipo_evento')
            .setDescription('Qual evento disparará esta regra? (Padrão: Todos)')
            .addChoices(
              { name: '🟢 Todos os Eventos (Entrada, Saída e Troca)', value: 'ALL' },
              { name: '👋 Apenas Entrada (Join)', value: 'JOIN' },
              { name: '🚪 Apenas Saída (Leave)', value: 'LEAVE' },
              { name: '🔀 Apenas Troca de Canal (Move)', value: 'MOVE' },
            ),
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
      sub
        .setName('listar')
        .setDescription('Lista todas as regras ativas de notificação de voz')
        .addChannelOption((opt) =>
          opt
            .setName('canal_voz')
            .setDescription('Filtrar regras de um canal específico')
            .addChannelTypes(ChannelType.GuildVoice),
        ),
    )
    // Subcommand: remover
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove uma regra específica pelo ID ou limpa um canal de voz')
        .addStringOption((opt) =>
          opt
            .setName('id_regra')
            .setDescription('ID da regra (use /voz-notificar listar para obter o ID)'),
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal_voz')
            .setDescription('Canal de voz para remover todas as suas regras vinculadas')
            .addChannelTypes(ChannelType.GuildVoice),
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

    if (subcommand === 'adicionar') {
      const voiceChannel = interaction.options.getChannel('canal_voz', true);
      const textChannel = interaction.options.getChannel('canal_texto', true);
      const eventType = (interaction.options.getString('tipo_evento') ||
        'ALL') as VoiceRuleEventType;
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
        eventType,
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

      const created = await voiceRepo.createRule(parsed.data);

      const eventTypeLabel =
        eventType === 'JOIN'
          ? '👋 Apenas Entrada'
          : eventType === 'LEAVE'
            ? '🚪 Apenas Saída'
            : eventType === 'MOVE'
              ? '🔀 Apenas Troca'
              : '🟢 Todos os Eventos';

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Regra de Voz Criada!',
            `**ID da Regra:** \`${created.id}\`\n**Canal de Voz:** <#${voiceChannel.id}>\n**Destino:** <#${textChannel.id}>\n**Evento:** ${eventTypeLabel}\n**Formato:** ${embed ? 'Embed' : 'Texto Simples'}\n**Mencionar:** ${mention ? 'Sim' : 'Não'}\n**Cooldown:** ${cooldown}s`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'listar') {
      const filterChannel = interaction.options.getChannel('canal_voz');
      let configs = await voiceRepo.listByGuild(guildId);

      if (filterChannel) {
        configs = configs.filter((c) => c.voiceChannelId === filterChannel.id);
      }

      if (configs.length === 0) {
        await interaction.reply({
          embeds: [
            BotEmbed.info(
              'Nenhuma Regra Encontrada',
              filterChannel
                ? `Não há regras ativas para o canal <#${filterChannel.id}>.`
                : 'Não há regras de voz configuradas neste servidor.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const desc = configs
        .map((c, idx) => {
          const typeIcon =
            c.eventType === 'JOIN'
              ? '👋 Entrada'
              : c.eventType === 'LEAVE'
                ? '🚪 Saída'
                : c.eventType === 'MOVE'
                  ? '🔀 Troca'
                  : '🟢 Todos';

          return (
            `**${idx + 1}. [${typeIcon}]** <#${c.voiceChannelId}> ➡️ <#${c.targetChannelId}>\n` +
            `└ ID: \`${c.id}\` | Status: ${c.enabled ? '🟢 Ativo' : '🔴 Inativo'} | Cooldown: ${c.cooldownSeconds}s`
          );
        })
        .join('\n\n');

      await interaction.reply({
        embeds: [
          BotEmbed.info(
            filterChannel
              ? `Regras de Notificação: #${filterChannel.name}`
              : 'Regras de Notificação de Voz Ativas',
            desc.slice(0, 4000),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'remover') {
      const ruleId = interaction.options.getString('id_regra');
      const voiceChannel = interaction.options.getChannel('canal_voz');

      if (!ruleId && !voiceChannel) {
        await interaction.reply({
          embeds: [
            BotEmbed.error(
              'Parâmetro Necessário',
              'Informe o `id_regra` para excluir uma regra específica, ou o `canal_voz` para remover todas as regras daquele canal.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      if (ruleId) {
        const deleted = await voiceRepo.deleteRule(ruleId, guildId);
        if (!deleted) {
          await interaction.reply({
            embeds: [
              BotEmbed.error('Não Encontrada', `Nenhuma regra encontrada com o ID \`${ruleId}\`.`),
            ],
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          embeds: [
            BotEmbed.success(
              'Regra Removida',
              `A regra \`${ruleId}\` (Voz <#${deleted.voiceChannelId}> ➡️ Texto <#${deleted.targetChannelId}>) foi removida com sucesso.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      if (voiceChannel) {
        const count = await voiceRepo.deleteByChannel(guildId, voiceChannel.id);
        if (count === 0) {
          await interaction.reply({
            embeds: [
              BotEmbed.error(
                'Não Encontrado',
                `O canal <#${voiceChannel.id}> não possuía regras cadastradas.`,
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          embeds: [
            BotEmbed.success(
              'Regras Removidas',
              `Todas as ${count} regra(s) vinculadas ao canal <#${voiceChannel.id}> foram removidas com sucesso.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }
    }

    if (subcommand === 'testar') {
      const voiceChannel = interaction.options.getChannel('canal_voz', true);
      const type = interaction.options.getString('tipo', true) as 'join' | 'leave' | 'move';

      const rules = await voiceRepo.findByChannel(guildId, voiceChannel.id);
      const matchingRule = rules.find(
        (r) => r.enabled && (r.eventType === 'ALL' || r.eventType === type.toUpperCase()),
      );

      if (!matchingRule) {
        await interaction.reply({
          embeds: [
            BotEmbed.error(
              'Nenhuma Regra Compatível',
              `Não há regras ativas configuradas para o evento **${type}** no canal <#${voiceChannel.id}>. Use \`/voz-notificar adicionar\` para criar uma.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const service = new VoiceNotificationService(container);
      await service.dispatchNotification(matchingRule, member, voiceChannel.id, type);

      await interaction.editReply({
        embeds: [
          BotEmbed.success(
            'Teste Enviado!',
            `Notificação de teste do tipo **${type}** disparada com sucesso para o canal <#${matchingRule.targetChannelId}> (Regra: \`${matchingRule.id}\`).`,
          ),
        ],
      });
    }
  },
};
