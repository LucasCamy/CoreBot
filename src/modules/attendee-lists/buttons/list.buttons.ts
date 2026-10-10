import { ButtonContext, IButtonHandler } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { AttendeeListService } from '../services/attendee.service.js';

export const listJoinButtonHandler: IButtonHandler = {
  customIdPrefix: 'list_join:',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const { interaction, container, member } = ctx;
    const listId = interaction.customId.replace('list_join:', '');
    const attendeeRepo = container.attendeeRepository;
    const listService = new AttendeeListService(container);

    const list = await attendeeRepo.findListById(listId);
    if (!list) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Lista Não Encontrada', 'Esta lista não existe mais no banco de dados.'),
        ],
        ephemeral: true,
      });
      return;
    }

    if (list.status !== 'OPEN') {
      await interaction.reply({
        embeds: [
          BotEmbed.warning('Lista Fechada', 'As inscrições para esta lista foram encerradas.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const alreadyJoined = list.attendees.some((att) => att.userId === member.id);
    if (alreadyJoined) {
      await interaction.reply({
        embeds: [BotEmbed.info('Já Inscrito', 'Você já confirmou sua presença nesta lista!')],
        ephemeral: true,
      });
      return;
    }

    if (list.maxSlots && list.attendees.length >= list.maxSlots) {
      await interaction.reply({
        embeds: [
          BotEmbed.warning(
            'Vagas Esgotadas',
            'Desculpe, todas as vagas para esta lista já foram preenchidas!',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // Add attendee
    await attendeeRepo.addAttendee(listId, member.id, member.displayName);

    // Sync updated message
    const updatedList = await attendeeRepo.findListById(listId);
    if (updatedList) {
      await listService.syncMessage(updatedList);
    }

    await interaction.reply({
      embeds: [
        BotEmbed.success(
          'Presença Confirmada!',
          `Você entrou na lista **${list.title}** com sucesso.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

export const listLeaveButtonHandler: IButtonHandler = {
  customIdPrefix: 'list_leave:',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const { interaction, container, member } = ctx;
    const listId = interaction.customId.replace('list_leave:', '');
    const attendeeRepo = container.attendeeRepository;
    const listService = new AttendeeListService(container);

    const list = await attendeeRepo.findListById(listId);
    if (!list) {
      await interaction.reply({
        embeds: [BotEmbed.error('Lista Não Encontrada', 'Esta lista não existe mais.')],
        ephemeral: true,
      });
      return;
    }

    const attendee = list.attendees.find((att) => att.userId === member.id);
    if (!attendee) {
      await interaction.reply({
        embeds: [BotEmbed.info('Não Inscrito', 'Você não está presente nesta lista.')],
        ephemeral: true,
      });
      return;
    }

    await attendeeRepo.removeAttendee(listId, member.id);

    const updatedList = await attendeeRepo.findListById(listId);
    if (updatedList) {
      await listService.syncMessage(updatedList);
    }

    await interaction.reply({
      embeds: [BotEmbed.success('Inscrição Cancelada', `Você saiu da lista **${list.title}**.`)],
      ephemeral: true,
    });
  },
};

export const listViewButtonHandler: IButtonHandler = {
  customIdPrefix: 'list_view:',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const { interaction, container } = ctx;
    const listId = interaction.customId.replace('list_view:', '');
    const attendeeRepo = container.attendeeRepository;

    const list = await attendeeRepo.findListById(listId);
    if (!list) {
      await interaction.reply({
        embeds: [BotEmbed.error('Lista Não Encontrada', 'Esta lista não foi encontrada.')],
        ephemeral: true,
      });
      return;
    }

    if (list.attendees.length === 0) {
      await interaction.reply({
        embeds: [
          BotEmbed.info(list.title, 'Ainda não há nenhum participante cadastrado nesta lista.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const participantsFormatted = list.attendees
      .map((att, i) => `**${i + 1}.** ${att.username} (<@${att.userId}>)`)
      .join('\n');

    await interaction.reply({
      embeds: [
        BotEmbed.info(
          `Participantes - ${list.title} (${list.attendees.length} pessoas)`,
          participantsFormatted,
        ),
      ],
      ephemeral: true,
    });
  },
};
