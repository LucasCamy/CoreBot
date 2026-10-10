import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { AgendaService } from '../services/agenda.service.js';
import { formatInTimezone, parseInTimezone } from '../../../utils/time.js';

export const agendaCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('agenda')
    .setDescription('Gerencia eventos, compromissos e lembretes automáticos')
    // Subcommand: criar
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Cria um novo evento na agenda com lembretes automáticos')
        .addStringOption((opt) =>
          opt.setName('titulo').setDescription('Título do evento').setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('data')
            .setDescription('Data no formato DD/MM/AAAA (ex: 25/12/2026)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('hora').setDescription('Hora no formato HH:MM (ex: 20:00)').setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal_aviso')
            .setDescription('Canal de texto onde os lembretes serão enviados')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('descricao').setDescription('Descrição detalhada do evento'),
        )
        .addStringOption((opt) =>
          opt
            .setName('lembretes')
            .setDescription('Minutos antes para avisar, separados por vírgula (ex: 60,30,10,5)'),
        ),
    )
    // Subcommand: listar
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista os próximos eventos agendados'),
    )
    // Subcommand: ver
    .addSubcommand((sub) =>
      sub
        .setName('ver')
        .setDescription('Exibe os detalhes de um evento específico')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('ID do evento').setRequired(true),
        ),
    )
    // Subcommand: editar
    .addSubcommand((sub) =>
      sub
        .setName('editar')
        .setDescription('Edita informações de um evento existente')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('ID do evento').setRequired(true),
        )
        .addStringOption((opt) => opt.setName('titulo').setDescription('Novo título'))
        .addStringOption((opt) => opt.setName('data').setDescription('Nova data (DD/MM/AAAA)'))
        .addStringOption((opt) => opt.setName('hora').setDescription('Nova hora (HH:MM)'))
        .addStringOption((opt) => opt.setName('descricao').setDescription('Nova descrição'))
        .addChannelOption((opt) =>
          opt
            .setName('canal_aviso')
            .setDescription('Novo canal de avisos')
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    // Subcommand: cancelar
    .addSubcommand((sub) =>
      sub
        .setName('cancelar')
        .setDescription('Cancela um evento agendado')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('ID do evento').setRequired(true),
        ),
    )
    // Subcommand: lembrar
    .addSubcommand((sub) =>
      sub
        .setName('lembrar')
        .setDescription('Dispara manualmente um lembrete imediato para o evento')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('ID do evento').setRequired(true),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, guildId, member } = ctx;
    const agendaRepo = container.agendaRepository;
    const agendaService = new AgendaService(container);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'criar') {
      const title = interaction.options.getString('titulo', true);
      const dateStr = interaction.options.getString('data', true);
      const timeStr = interaction.options.getString('hora', true);
      const channel = interaction.options.getChannel('canal_aviso', true);
      const description = interaction.options.getString('descricao');
      const remindersStr = interaction.options.getString('lembretes');

      let reminderMinutes: number[] = [60, 30, 10, 5];
      if (remindersStr) {
        reminderMinutes = remindersStr
          .split(',')
          .map((m) => parseInt(m.trim(), 10))
          .filter((m) => !isNaN(m) && m > 0);
      }

      const result = await agendaService.createEvent({
        guildId,
        title,
        description,
        dateStr,
        timeStr,
        reminderChannelId: channel.id,
        reminderMinutesBefore: reminderMinutes,
        createdByUserId: member.id,
      });

      if (!result.success || !result.event) {
        await interaction.reply({
          embeds: [BotEmbed.error('Erro ao Criar Evento', result.error || 'Falha desconhecida.')],
          ephemeral: true,
        });
        return;
      }

      const guildConfig = await container.guildRepository.findByGuildId(guildId);
      const tz = guildConfig?.timezone || 'America/Sao_Paulo';
      const formattedDate = formatInTimezone(result.event.startsAt, tz, 'DD/MM/YYYY [às] HH:mm');

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Evento Criado na Agenda!',
            `📅 **Título:** ${result.event.title}\n⏰ **Data:** ${formattedDate} (${tz})\n📢 **Canal de Avisos:** <#${channel.id}>\n🔔 **Lembretes:** ${reminderMinutes.join(', ')} min antes\n🆔 **ID:** \`${result.event.id}\``,
          ),
        ],
      });
      return;
    }

    if (subcommand === 'listar') {
      const events = await agendaRepo.listUpcoming(guildId);
      if (events.length === 0) {
        await interaction.reply({
          embeds: [BotEmbed.info('Agenda Vazia', 'Não há eventos futuros agendados.')],
          ephemeral: true,
        });
        return;
      }

      const guildConfig = await container.guildRepository.findByGuildId(guildId);
      const tz = guildConfig?.timezone || 'America/Sao_Paulo';

      const desc = events
        .map((e, idx) => {
          const date = formatInTimezone(e.startsAt, tz, 'DD/MM/YYYY HH:mm');
          return `**${idx + 1}. ${e.title}**\n📅 ${date} | Canal: <#${e.reminderChannelId}>\n🆔 \`${e.id}\``;
        })
        .join('\n\n');

      await interaction.reply({
        embeds: [BotEmbed.info('Próximos Eventos da Agenda', desc)],
      });
      return;
    }

    if (subcommand === 'ver') {
      const eventId = interaction.options.getString('id', true);
      const data = await agendaService.getEventFormatted(guildId, eventId);

      if (!data) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrado', 'Nenhum evento encontrado com esse ID.')],
          ephemeral: true,
        });
        return;
      }

      const { event, timezone } = data;
      const formattedDate = formatInTimezone(event.startsAt, timezone, 'DD/MM/YYYY [às] HH:mm');

      await interaction.reply({
        embeds: [
          BotEmbed.info(
            event.title,
            `📝 **Descrição:** ${event.description || 'Sem descrição.'}\n📅 **Data/Hora:** ${formattedDate} (${timezone})\n📢 **Canal de Avisos:** <#${event.reminderChannelId}>\n👤 **Criado por:** <@${event.createdByUserId}>\n📊 **Status:** ${event.status}\n🔔 **Lembretes configurados:** ${event.reminderMinutesBefore.join(', ')} min\n🆔 **ID:** \`${event.id}\``,
          ),
        ],
      });
      return;
    }

    if (subcommand === 'editar') {
      const eventId = interaction.options.getString('id', true);
      const existing = await agendaRepo.findById(eventId);

      if (!existing || existing.guildId !== guildId) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrado', 'Evento não encontrado neste servidor.')],
          ephemeral: true,
        });
        return;
      }

      const newTitle = interaction.options.getString('titulo');
      const newDateStr = interaction.options.getString('data');
      const newTimeStr = interaction.options.getString('hora');
      const newDesc = interaction.options.getString('descricao');
      const newChannel = interaction.options.getChannel('canal_aviso');

      let newStartsAt = existing.startsAt;
      if (newDateStr || newTimeStr) {
        const guildConfig = await container.guildRepository.findByGuildId(guildId);
        const tz = guildConfig?.timezone || 'America/Sao_Paulo';
        const currentFormatted = formatInTimezone(existing.startsAt, tz, 'DD/MM/YYYY HH:mm');
        const [currD, currT] = currentFormatted.split(' ');
        const finalDate = newDateStr || currD;
        const finalTime = newTimeStr || currT;
        newStartsAt = parseInTimezone(`${finalDate} ${finalTime}`, 'DD/MM/YYYY HH:mm', tz);
      }

      await agendaRepo.update(eventId, {
        title: newTitle ?? existing.title,
        description: newDesc !== null ? newDesc : existing.description,
        startsAt: newStartsAt,
        reminderChannelId: newChannel?.id ?? existing.reminderChannelId,
      });

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Evento Atualizado',
            `As alterações no evento \`${existing.title}\` foram salvas com sucesso.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'cancelar') {
      const eventId = interaction.options.getString('id', true);
      const existing = await agendaRepo.findById(eventId);

      if (!existing || existing.guildId !== guildId) {
        await interaction.reply({
          embeds: [BotEmbed.error('Não Encontrado', 'Evento não encontrado.')],
          ephemeral: true,
        });
        return;
      }

      await agendaRepo.cancel(eventId);
      await interaction.reply({
        embeds: [
          BotEmbed.success('Evento Cancelado', `O evento \`${existing.title}\` foi cancelado.`),
        ],
      });
      return;
    }

    if (subcommand === 'lembrar') {
      const eventId = interaction.options.getString('id', true);
      await interaction.deferReply({ ephemeral: true });

      const ok = await agendaService.triggerManualReminder(guildId, eventId);
      if (ok) {
        await interaction.editReply({
          embeds: [
            BotEmbed.success(
              'Lembrete Enviado',
              'O lembrete imediato foi despachado para o canal configurado!',
            ),
          ],
        });
      } else {
        await interaction.editReply({
          embeds: [
            BotEmbed.error(
              'Falha no Envio',
              'Não foi possível disparar o lembrete para esse evento.',
            ),
          ],
        });
      }
    }
  },
};
