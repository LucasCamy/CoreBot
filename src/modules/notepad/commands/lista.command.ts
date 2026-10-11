import { SlashCommandBuilder } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { createNotepadListSchema } from '../schemas/notepad.schema.js';
import { NotepadService } from '../services/notepad.service.js';
import { PermissionGuard } from '../../../discord/guards/permission.guard.js';

export const listaCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('lista')
    .setDescription('Gerencia listas dinâmicas, blocos de notas e checklists colaborativos')
    // Subcommand: criar
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Cria um novo bloco de notas interativo neste canal')
        .addStringOption((opt) =>
          opt
            .setName('titulo')
            .setDescription('Título da lista ou bloco de notas')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('descricao')
            .setDescription('Descrição ou observações opcionais para a lista'),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('colaborativa')
            .setDescription('Permitir que outros membros adicionem e marquem itens? (Padrão: sim)'),
        )
        .addStringOption((opt) =>
          opt
            .setName('cor')
            .setDescription('Cor hex do embed (ex: #5865F2, #2ECC71, #E74C3C)'),
        ),
    )
    // Subcommand: listar
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Lista todos os blocos de notas deste servidor'),
    )
    // Subcommand: apagar
    .addSubcommand((sub) =>
      sub
        .setName('apagar')
        .setDescription('Exclui um bloco de notas existente')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('ID da lista a ser excluída')
            .setRequired(true),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, guildId, member } = ctx;
    const repo = container.notepadRepository;
    const service = new NotepadService(container);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'criar') {
      const title = interaction.options.getString('titulo', true);
      const description = interaction.options.getString('descricao');
      const isCollaborative = interaction.options.getBoolean('colaborativa') ?? true;
      const color = interaction.options.getString('cor') ?? '#5865F2';

      const validation = createNotepadListSchema.safeParse({
        title,
        description,
        color,
        isCollaborative,
      });

      if (!validation.success) {
        await interaction.reply({
          embeds: [BotEmbed.error('Dados Inválidos', validation.error.errors[0].message)],
          ephemeral: true,
        });
        return;
      }

      // 1. Create list record in database
      const createdList = await repo.createList({
        guildId,
        channelId: interaction.channelId,
        title: validation.data.title,
        description: validation.data.description,
        color: validation.data.color,
        isCollaborative: validation.data.isCollaborative,
        ownerId: member.id,
      });

      // 2. Render initial list view
      const rendered = service.renderList(createdList);

      // 3. Send interactive widget
      await interaction.reply({
        embeds: rendered.embeds,
        components: rendered.components,
      });

      const replyMsg = await interaction.fetchReply();

      // 4. Update messageId in DB
      await repo.updateList(createdList.id, { messageId: replyMsg.id });
      return;
    }

    if (subcommand === 'listar') {
      const lists = await repo.listByGuild(guildId);

      if (lists.length === 0) {
        await interaction.reply({
          embeds: [
            BotEmbed.info(
              'Nenhum Bloco de Notas',
              'Não há listas criadas neste servidor ainda. Crie uma agora usando `/lista criar`!',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const desc = lists
        .map((l, idx) => {
          const total = l.items.length;
          const completed = l.items.filter((i) => i.isCompleted).length;
          const mode = l.isCollaborative ? '👥 Colaborativa' : '🔒 Privada';

          return `**${idx + 1}. ${l.title}**\n` +
            `└ ID: \`${l.id}\` | Itens: ${completed}/${total} | Modo: ${mode} | Canal: <#${l.channelId}> | Criador: <@${l.ownerId}>`;
        })
        .join('\n\n');

      await interaction.reply({
        embeds: [BotEmbed.info('Blocos de Notas do Servidor', desc.slice(0, 4000))],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'apagar') {
      const listId = interaction.options.getString('id', true);
      const list = await repo.findById(listId);

      if (!list || list.guildId !== guildId) {
        await interaction.reply({
          embeds: [BotEmbed.error('Lista Não Encontrada', `Nenhum bloco de notas com o ID \`${listId}\`.`)],
          ephemeral: true,
        });
        return;
      }

      const isAdmin = await PermissionGuard.isAdmin(member, container);
      const isOwner = list.ownerId === member.id;

      if (!isOwner && !isAdmin) {
        await interaction.reply({
          embeds: [BotEmbed.error('Sem Permissão', 'Apenas o criador da lista ou administradores podem apagá-la.')],
          ephemeral: true,
        });
        return;
      }

      await repo.deleteList(listId, guildId);

      if (list.messageId) {
        try {
          const channel = await ctx.guild.channels.fetch(list.channelId).catch(() => null);
          if (channel && channel.isTextBased() && 'messages' in channel) {
            const msg = await channel.messages.fetch(list.messageId).catch(() => null);
            if (msg) await msg.delete().catch(() => null);
          }
        } catch {
          // Message might already be deleted
        }
      }

      await interaction.reply({
        embeds: [BotEmbed.success('Lista Excluída', `O bloco de notas "${list.title}" foi apagado permanentemente.`)],
        ephemeral: true,
      });
      return;
    }
  },
};
