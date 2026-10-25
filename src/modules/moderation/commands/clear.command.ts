import { NewsChannel, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { ClearService } from '../services/clear.service.js';

export const clearCommand: ICommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('limpar')
    .setDescription('Comandos de limpeza e moderação de mensagens e canais')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages | PermissionFlagsBits.ManageChannels,
    )
    // Subcommand: mensagens
    .addSubcommand((sub) =>
      sub
        .setName('mensagens')
        .setDescription('Apaga uma quantidade de mensagens recentes no canal atual')
        .addIntegerOption((opt) =>
          opt
            .setName('quantidade')
            .setDescription('Quantidade de mensagens a apagar (1 a 100)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true),
        )
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('Apagar apenas mensagens enviadas por este usuário específico'),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('apenas_bots')
            .setDescription('Apagar apenas mensagens enviadas por bots no canal?'),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('apenas_anexos')
            .setDescription('Apagar apenas mensagens que contenham fotos ou anexos?'),
        ),
    )
    // Subcommand: canal (nuke)
    .addSubcommand((sub) =>
      sub
        .setName('canal')
        .setDescription('Limpa TODO o canal recriando-o do zero (apaga 100% do histórico)')
        .addBooleanOption((opt) =>
          opt
            .setName('confirmar')
            .setDescription('Confirme com True para recriar o canal e apagar todo o histórico')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('motivo')
            .setDescription('Motivo da limpeza geral do canal (registrado no Log de Auditoria)'),
        ),
    ),

  async execute(ctx: CommandContext): Promise<void> {
    const { interaction, container, guild, member } = ctx;

    const channel = interaction.channel;
    if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel)) {
      await interaction.reply({
        embeds: [
          BotEmbed.error(
            'Canal Inválido',
            'Este comando só pode ser executado em canais de texto ou anúncios do servidor.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    if (!botMember) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Erro Interno', 'Não foi possível verificar os dados do bot no servidor.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const service = new ClearService(container);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'mensagens') {
      await interaction.deferReply({ ephemeral: true });

      const quantidade = interaction.options.getInteger('quantidade', true);
      const targetUser = interaction.options.getUser('usuario');
      const apenasBots = interaction.options.getBoolean('apenas_bots') ?? undefined;
      const apenasAnexos = interaction.options.getBoolean('apenas_anexos') ?? undefined;

      const result = await service.purgeMessages(
        channel,
        {
          quantidade,
          usuarioId: targetUser?.id,
          apenasBots,
          apenasAnexos,
        },
        botMember,
      );

      if (!result.success) {
        await interaction.editReply({
          embeds: [
            BotEmbed.error('Falha ao Apagar Mensagens', result.error || 'Erro desconhecido.'),
          ],
        });
        return;
      }

      if (result.deletedCount === 0) {
        await interaction.editReply({
          embeds: [
            BotEmbed.info(
              'Nenhuma Mensagem Apagada',
              result.error || 'Não foram encontradas mensagens elegíveis para apagar no canal.',
            ),
          ],
        });
        return;
      }

      let description = `🧹 Foram apagadas com sucesso **${result.deletedCount}** mensagem(ns) deste canal.`;
      if (targetUser) {
        description += `\n👤 **Filtro:** Apenas mensagens de <@${targetUser.id}>`;
      }
      if (apenasBots) {
        description += `\n🤖 **Filtro:** Apenas mensagens de Bots`;
      }
      if (apenasAnexos) {
        description += `\n📎 **Filtro:** Apenas mensagens com anexos/mídias`;
      }
      if (result.filteredOld > 0) {
        description += `\n\n⚠️ **Aviso:** **${result.filteredOld}** mensagem(ns) tinham mais de 14 dias e não puderam ser apagadas em massa devido a limitações da API do Discord.`;
      }

      await interaction.editReply({
        embeds: [BotEmbed.success('Limpeza Concluída', description)],
      });
      return;
    }

    if (subcommand === 'canal') {
      const confirmar = interaction.options.getBoolean('confirmar', true);
      const motivo = interaction.options.getString('motivo') ?? undefined;

      if (!confirmar) {
        await interaction.reply({
          embeds: [
            BotEmbed.warning(
              'Ação Cancelada',
              'Para recriar este canal e apagar **100% das mensagens**, selecione a opção `confirmar: True`.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const result = await service.nukeChannel(channel, member, botMember, motivo);

      if (!result.success) {
        await interaction.editReply({
          embeds: [BotEmbed.error('Falha ao Limpar Canal', result.error || 'Erro desconhecido.')],
        });
        return;
      }

      // If success, old channel is deleted, no editReply possible as channel ceases to exist.
    }
  },
};
