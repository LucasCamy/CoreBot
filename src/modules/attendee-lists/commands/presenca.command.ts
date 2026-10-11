import { AttachmentBuilder, ChannelType, SlashCommandBuilder } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { AttendeeListService } from '../services/attendee.service.js';
import { createListSchema } from '../schemas/list.schema.js';

export const presencaCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('presenca')
    .setDescription('Gerencia listas de presença e confirmações com botões interativos')
    // Subcommand: criar
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Cria uma nova lista interativa de presença')
        .addStringOption((opt) =>
          opt.setName('titulo').setDescription('Título da lista').setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal de texto onde a mensagem interativa será postada')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption((opt) => opt.setName('descricao').setDescription('Descrição da lista'))
        .addIntegerOption((opt) =>
          opt.setName('vagas').setDescription('Número máximo de vagas permitidas'),
        ),
    )
    // Subcommand: ver
    .addSubcommand((sub) =>
      sub
        .setName('ver')
        .setDescription('Visualiza o status e participantes de uma lista')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('ID da lista').setRequired(true),
        ),
    )
    // Subcommand: fechar
    .addSubcommand((sub) =>
      sub
        .setName('fechar')
        .setDescription('Encerra as inscrições de uma lista')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('ID da lista').setRequired(true),
        ),
    )
    // Subcommand: reabrir
    .addSubcommand((sub) =>
      sub
        .setName('reabrir')
        .setDescription('Reabre as inscrições de uma lista')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('ID da lista').setRequired(true),
        ),
    )
    // Subcommand: remover
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove uma lista do banco de dados')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('ID da lista').setRequired(true),
        ),
    )
    // Subcommand: exportar
    .addSubcommand((sub) =>
      sub
        .setName('exportar')
        .setDescription('Exporta a lista de participantes em formato CSV')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('ID da lista').setRequired(true),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, guildId, member } = ctx;
    const attendeeRepo = container.attendeeRepository;
    const listService = new AttendeeListService(container);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'criar') {
      const title = interaction.options.getString('titulo', true);
      const channel = interaction.options.getChannel('canal', true);
      const description = interaction.options.getString('descricao');
      const maxSlots = interaction.options.getInteger('vagas');

      const parsed = createListSchema.safeParse({
        guildId,
        title,
        description,
        channelId: channel.id,
        maxSlots,
        createdByUserId: member.id,
      });

      if (!parsed.success) {
        await interaction.reply({
          embeds: [BotEmbed.error('Dados Inválidos', parsed.error.errors[0].message)],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Create list record
      const newList = await attendeeRepo.createList(parsed.data);

      const guildConfig = await container.guildRepository.findByGuildId(guildId);
      const tz = guildConfig?.timezone || 'America/Sao_Paulo';

      // Build interactive UI embed & buttons
      const listWithAttendees = { ...newList, attendees: [] };
      const embed = listService.buildListEmbed(listWithAttendees, tz);
      const components = [listService.buildListButtons(newList.id, false)];

      // Send to channel via central NotificationService
      const sentMsg = await container.notificationService.sendToChannel({
        guildId,
        module: 'attendee-lists',
        eventType: 'list_created',
        channelId: channel.id,
        embeds: [embed],
        components,
      });

      if (sentMsg) {
        await attendeeRepo.updateList(newList.id, { messageId: sentMsg.id });
      }

      await interaction.editReply({
        embeds: [
          BotEmbed.success(
            'Lista Criada com Sucesso!',
            `A mensagem interativa foi publicada em <#${channel.id}>.\n\n🆔 **ID da Lista:** \`${newList.id}\``,
          ),
        ],
      });
      return;
    }

    if (subcommand === 'ver') {
      const listId = interaction.options.getString('id', true);
      const list = await attendeeRepo.findListById(listId);

      if (!list || list.guildId !== guildId) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrada', 'Lista não encontrada neste servidor.')],
          ephemeral: true,
        });
        return;
      }

      const guildConfig = await container.guildRepository.findByGuildId(guildId);
      const tz = guildConfig?.timezone || 'America/Sao_Paulo';
      const embed = listService.buildListEmbed(list, tz);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'fechar') {
      const listId = interaction.options.getString('id', true);
      const list = await attendeeRepo.findListById(listId);

      if (!list || list.guildId !== guildId) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrada', 'Lista não encontrada.')],
          ephemeral: true,
        });
        return;
      }

      const updated = await attendeeRepo.updateList(listId, { status: 'CLOSED' });
      const refreshed = await attendeeRepo.findListById(listId);
      if (refreshed) {
        await listService.syncMessage(refreshed);
      }

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Lista Encerrada',
            `As inscrições para a lista **${updated.title}** foram fechadas.`,
          ),
        ],
      });
      return;
    }

    if (subcommand === 'reabrir') {
      const listId = interaction.options.getString('id', true);
      const list = await attendeeRepo.findListById(listId);

      if (!list || list.guildId !== guildId) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrada', 'Lista não encontrada.')],
          ephemeral: true,
        });
        return;
      }

      const updated = await attendeeRepo.updateList(listId, { status: 'OPEN' });
      const refreshed = await attendeeRepo.findListById(listId);
      if (refreshed) {
        await listService.syncMessage(refreshed);
      }

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Lista Reaberta',
            `A lista **${updated.title}** foi reaberta para inscrições.`,
          ),
        ],
      });
      return;
    }

    if (subcommand === 'remover') {
      const listId = interaction.options.getString('id', true);
      const list = await attendeeRepo.findListById(listId);

      if (!list || list.guildId !== guildId) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrada', 'Lista não encontrada.')],
          ephemeral: true,
        });
        return;
      }

      await attendeeRepo.deleteList(listId);
      await interaction.reply({
        embeds: [
          BotEmbed.success('Lista Removida', `A lista **${list.title}** foi removida com sucesso.`),
        ],
      });
      return;
    }

    if (subcommand === 'exportar') {
      const listId = interaction.options.getString('id', true);
      const list = await attendeeRepo.findListById(listId);

      if (!list || list.guildId !== guildId) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrada', 'Lista não encontrada.')],
          ephemeral: true,
        });
        return;
      }

      const guildConfig = await container.guildRepository.findByGuildId(guildId);
      const tz = guildConfig?.timezone || 'America/Sao_Paulo';

      const csvData = listService.generateCsv(list, tz);
      const buffer = Buffer.from(csvData, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `lista-${list.id}.csv` });

      await interaction.reply({
        content: `📁 Aqui está o arquivo CSV com os participantes da lista **${list.title}**:`,
        files: [attachment],
        ephemeral: true,
      });
    }
  },
};
