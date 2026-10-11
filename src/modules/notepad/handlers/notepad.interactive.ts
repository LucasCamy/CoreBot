import {
  ActionRowBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
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
import { PermissionGuard } from '../../../discord/guards/permission.guard.js';
import { NotepadService } from '../services/notepad.service.js';
import { addNotepadItemSchema, customizeNotepadListSchema } from '../schemas/notepad.schema.js';

async function checkPermission(
  ctx: ButtonContext | ModalContext | SelectMenuContext,
  listId: string,
  requireOwnerOrAdminOnly = false,
): Promise<{ allowed: boolean; list?: any }> {
  const list = await ctx.container.notepadRepository.findById(listId);
  if (!list) {
    return { allowed: false };
  }

  const isAdmin = await PermissionGuard.isAdmin(ctx.member, ctx.container);
  const isOwner = list.ownerId === ctx.member.id;

  if (requireOwnerOrAdminOnly) {
    return { allowed: isOwner || isAdmin, list };
  }

  if (list.isCollaborative) {
    return { allowed: true, list };
  }

  return { allowed: isOwner || isAdmin, list };
}

// ==========================================
// Button: Adicionar Item
// ==========================================
export const notepadAddButton: IButtonHandler = {
  customIdPrefix: 'notepad_btn_add_',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_btn_add_', '');
    const { allowed, list } = await checkPermission(ctx, listId, false);

    if (!list) {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.error('Lista Não Encontrada', 'Esta lista não existe mais no banco de dados.'),
        ],
        ephemeral: true,
      });
      return;
    }

    if (!allowed) {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.error(
            'Acesso Restrito',
            'Esta lista é privada. Apenas o criador pode adicionar itens.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`notepad_modal_add_${listId}`)
      .setTitle(`Adicionar Item: ${list.title}`.slice(0, 45));

    const itemInput = new TextInputBuilder()
      .setCustomId('notepad_input_content')
      .setLabel('Descrição do Item / Tarefa')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ex: Organizar call de alinhamento com a equipe')
      .setMinLength(1)
      .setMaxLength(250)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(itemInput));
    await ctx.interaction.showModal(modal);
  },
};

// ==========================================
// Button: Concluir / Desmarcar Item
// ==========================================
export const notepadToggleButton: IButtonHandler = {
  customIdPrefix: 'notepad_btn_toggle_',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_btn_toggle_', '');
    const { allowed, list } = await checkPermission(ctx, listId, false);

    if (!list) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Lista Não Encontrada')],
        ephemeral: true,
      });
      return;
    }

    if (!allowed) {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.error('Acesso Restrito', 'Apenas o criador pode alterar o status dos itens.'),
        ],
        ephemeral: true,
      });
      return;
    }

    if (list.items.length === 0) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.info('Lista Vazia', 'Não há itens na lista para marcar ou desmarcar.')],
        ephemeral: true,
      });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`notepad_sel_toggle_${listId}`)
      .setPlaceholder('Escolha um item para alternar o status...')
      .setMaxValues(1);

    list.items.slice(0, 25).forEach((item: any, idx: number) => {
      select.addOptions({
        label: `${idx + 1}. ${item.content}`.slice(0, 100),
        description: `Status: ${item.isCompleted ? 'Concluído' : 'Pendente'}`,
        value: item.id,
        emoji: item.isCompleted ? '✅' : '⬜',
      });
    });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await ctx.interaction.reply({
      content: 'Selecione o item abaixo para marcar ou desmarcar como concluído:',
      components: [row],
      ephemeral: true,
    });
  },
};

// ==========================================
// Button: Escolher Item para Editar
// ==========================================
export const notepadEditButton: IButtonHandler = {
  customIdPrefix: 'notepad_btn_edit_',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_btn_edit_', '');
    const { allowed, list } = await checkPermission(ctx, listId, false);

    if (!list) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Lista Não Encontrada')],
        ephemeral: true,
      });
      return;
    }

    if (!allowed) {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.error('Acesso Restrito', 'Apenas o criador pode editar itens desta lista.'),
        ],
        ephemeral: true,
      });
      return;
    }

    if (list.items.length === 0) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.info('Lista Vazia', 'Não há itens na lista para editar.')],
        ephemeral: true,
      });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`notepad_sel_editpick_${listId}`)
      .setPlaceholder('Escolha qual item deseja editar...')
      .setMaxValues(1);

    list.items.slice(0, 25).forEach((item: any, idx: number) => {
      select.addOptions({
        label: `${idx + 1}. ${item.content}`.slice(0, 100),
        value: item.id,
        emoji: '✏️',
      });
    });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await ctx.interaction.reply({
      content: 'Selecione qual item deseja alterar:',
      components: [row],
      ephemeral: true,
    });
  },
};

// ==========================================
// Button: Excluir Item
// ==========================================
export const notepadDeleteItemButton: IButtonHandler = {
  customIdPrefix: 'notepad_btn_delitem_',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_btn_delitem_', '');
    const { allowed, list } = await checkPermission(ctx, listId, false);

    if (!list) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Lista Não Encontrada')],
        ephemeral: true,
      });
      return;
    }

    if (!allowed) {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.error('Acesso Restrito', 'Apenas o criador pode remover itens desta lista.'),
        ],
        ephemeral: true,
      });
      return;
    }

    if (list.items.length === 0) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.info('Lista Vazia', 'Não há itens para remover.')],
        ephemeral: true,
      });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`notepad_sel_del_${listId}`)
      .setPlaceholder('Escolha o item a ser apagado...')
      .setMaxValues(1);

    list.items.slice(0, 25).forEach((item: any, idx: number) => {
      select.addOptions({
        label: `${idx + 1}. ${item.content}`.slice(0, 100),
        value: item.id,
        emoji: '🗑️',
      });
    });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await ctx.interaction.reply({
      content: '⚠️ Selecione o item que deseja excluir permanentemente:',
      components: [row],
      ephemeral: true,
    });
  },
};

// ==========================================
// Button: Limpar Itens Concluídos
// ==========================================
export const notepadClearDoneButton: IButtonHandler = {
  customIdPrefix: 'notepad_btn_clear_',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_btn_clear_', '');
    const { allowed, list } = await checkPermission(ctx, listId, false);

    if (!list) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Lista Não Encontrada')],
        ephemeral: true,
      });
      return;
    }

    if (!allowed) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Acesso Restrito')],
        ephemeral: true,
      });
      return;
    }

    const count = await ctx.container.notepadRepository.clearCompleted(listId);
    const service = new NotepadService(ctx.container);
    await service.refreshListMessage(listId, ctx.interaction.channel as TextChannel);

    await ctx.interaction.reply({
      embeds: [
        BotEmbed.success(
          'Itens Limpos',
          `${count} item(ns) concluído(s) foram removidos da lista.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

// ==========================================
// Button: Personalizar Lista (Título, Descrição, Cor)
// ==========================================
export const notepadCustomizeButton: IButtonHandler = {
  customIdPrefix: 'notepad_btn_custom_',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_btn_custom_', '');
    const { allowed, list } = await checkPermission(ctx, listId, true);

    if (!list) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Lista Não Encontrada')],
        ephemeral: true,
      });
      return;
    }

    if (!allowed) {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.error(
            'Acesso Negado',
            'Apenas o dono da lista ou administradores podem personalizar as opções da lista.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`notepad_modal_custom_${listId}`)
      .setTitle('Personalizar Bloco de Notas');

    const titleInput = new TextInputBuilder()
      .setCustomId('notepad_input_title')
      .setLabel('Título da Lista')
      .setStyle(TextInputStyle.Short)
      .setValue(list.title)
      .setMaxLength(100)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('notepad_input_desc')
      .setLabel('Descrição / Informações Adicionais')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(list.description || '')
      .setMaxLength(500)
      .setRequired(false);

    const colorInput = new TextInputBuilder()
      .setCustomId('notepad_input_color')
      .setLabel('Cor Hexadecimal do Embed')
      .setStyle(TextInputStyle.Short)
      .setValue(list.color || '#5865F2')
      .setMaxLength(7)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
    );

    await ctx.interaction.showModal(modal);
  },
};

// ==========================================
// Button: Alternar Modo (Público/Privado)
// ==========================================
export const notepadToggleModeButton: IButtonHandler = {
  customIdPrefix: 'notepad_btn_mode_',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_btn_mode_', '');
    const { allowed, list } = await checkPermission(ctx, listId, true);

    if (!list) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Lista Não Encontrada')],
        ephemeral: true,
      });
      return;
    }

    if (!allowed) {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.error(
            'Acesso Negado',
            'Apenas o dono da lista pode alterar as permissões de colaboração.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const nextMode = !list.isCollaborative;
    await ctx.container.notepadRepository.updateList(listId, { isCollaborative: nextMode });

    const service = new NotepadService(ctx.container);
    await service.refreshListMessage(listId, ctx.interaction.channel as TextChannel);

    await ctx.interaction.reply({
      embeds: [
        BotEmbed.success(
          'Modo Atualizado',
          nextMode
            ? 'A lista agora é **Colaborativa** (qualquer membro pode adicionar itens e marcar tarefas).'
            : 'A lista agora é **Pessoal** (apenas você pode adicionar ou alterar itens).',
        ),
      ],
      ephemeral: true,
    });
  },
};

// ==========================================
// Button: Apagar Lista Completa
// ==========================================
export const notepadDeleteListButton: IButtonHandler = {
  customIdPrefix: 'notepad_btn_dellist_',
  execute: async (ctx: ButtonContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_btn_dellist_', '');
    const { allowed, list } = await checkPermission(ctx, listId, true);

    if (!list) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Lista Não Encontrada')],
        ephemeral: true,
      });
      return;
    }

    if (!allowed) {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.error(
            'Acesso Negado',
            'Apenas o dono da lista ou um administrador pode apagar este bloco.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await ctx.container.notepadRepository.deleteList(listId, ctx.guild.id);
    await ctx.interaction.message.delete().catch(() => null);

    await ctx.interaction.reply({
      embeds: [
        BotEmbed.success('Bloco Excluído', `A lista "${list.title}" foi excluída com sucesso.`),
      ],
      ephemeral: true,
    });
  },
};

// ==========================================
// Modal: Adicionar Item
// ==========================================
export const notepadAddModalHandler: IModalHandler = {
  customIdPrefix: 'notepad_modal_add_',
  execute: async (ctx: ModalContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_modal_add_', '');
    const rawContent = ctx.interaction.fields.getTextInputValue('notepad_input_content');

    const validation = addNotepadItemSchema.safeParse({ content: rawContent });
    if (!validation.success) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Item Inválido', validation.error.errors[0].message)],
        ephemeral: true,
      });
      return;
    }

    await ctx.container.notepadRepository.addItem(listId, validation.data.content, ctx.member.id);

    const service = new NotepadService(ctx.container);
    await service.refreshListMessage(listId, ctx.interaction.channel as TextChannel);

    await ctx.interaction.reply({
      embeds: [BotEmbed.success('Item Adicionado', `O item foi adicionado à lista com sucesso.`)],
      ephemeral: true,
    });
  },
};

// ==========================================
// Modal: Editar Item
// ==========================================
export const notepadEditModalHandler: IModalHandler = {
  customIdPrefix: 'notepad_modal_edit_',
  execute: async (ctx: ModalContext): Promise<void> => {
    // customId format: notepad_modal_edit_${listId}_${itemId}
    const parts = ctx.interaction.customId.replace('notepad_modal_edit_', '').split('_');
    const listId = parts[0];
    const itemId = parts[1];

    const rawContent = ctx.interaction.fields.getTextInputValue('notepad_input_edit_content');
    const validation = addNotepadItemSchema.safeParse({ content: rawContent });

    if (!validation.success) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Item Inválido', validation.error.errors[0].message)],
        ephemeral: true,
      });
      return;
    }

    await ctx.container.notepadRepository.updateItemContent(itemId, validation.data.content);

    const service = new NotepadService(ctx.container);
    await service.refreshListMessage(listId, ctx.interaction.channel as TextChannel);

    await ctx.interaction.reply({
      embeds: [
        BotEmbed.success('Item Atualizado', 'O conteúdo do item foi modificado com sucesso.'),
      ],
      ephemeral: true,
    });
  },
};

// ==========================================
// Modal: Personalizar Lista
// ==========================================
export const notepadCustomizeModalHandler: IModalHandler = {
  customIdPrefix: 'notepad_modal_custom_',
  execute: async (ctx: ModalContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_modal_custom_', '');
    const title = ctx.interaction.fields.getTextInputValue('notepad_input_title');
    const description = ctx.interaction.fields.getTextInputValue('notepad_input_desc');
    const color = ctx.interaction.fields.getTextInputValue('notepad_input_color');

    const validation = customizeNotepadListSchema.safeParse({
      title,
      description: description.trim() === '' ? null : description,
      color: color.trim() === '' ? '#5865F2' : color,
    });

    if (!validation.success) {
      await ctx.interaction.reply({
        embeds: [BotEmbed.error('Dados Inválidos', validation.error.errors[0].message)],
        ephemeral: true,
      });
      return;
    }

    await ctx.container.notepadRepository.updateList(listId, validation.data);

    const service = new NotepadService(ctx.container);
    await service.refreshListMessage(listId, ctx.interaction.channel as TextChannel);

    await ctx.interaction.reply({
      embeds: [
        BotEmbed.success('Bloco Personalizado', 'As informações da lista foram atualizadas!'),
      ],
      ephemeral: true,
    });
  },
};

// ==========================================
// SelectMenu: Alternar Status do Item
// ==========================================
export const notepadToggleSelectHandler: ISelectMenuHandler = {
  customIdPrefix: 'notepad_sel_toggle_',
  execute: async (ctx: SelectMenuContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_sel_toggle_', '');
    const itemId = ctx.interaction.values[0];

    const updated = await ctx.container.notepadRepository.toggleItem(itemId, ctx.member.id);
    if (!updated) {
      await ctx.interaction.update({
        content: '⚠️ O item selecionado não foi encontrado.',
        components: [],
      });
      return;
    }

    const service = new NotepadService(ctx.container);
    await service.refreshListMessage(listId, ctx.interaction.channel as TextChannel);

    await ctx.interaction.update({
      content: `Item marcado como **${updated.isCompleted ? 'Concluído ✅' : 'Pendente ⬜'}** com sucesso!`,
      components: [],
    });
  },
};

// ==========================================
// SelectMenu: Excluir Item Selecionado
// ==========================================
export const notepadDeleteSelectHandler: ISelectMenuHandler = {
  customIdPrefix: 'notepad_sel_del_',
  execute: async (ctx: SelectMenuContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_sel_del_', '');
    const itemId = ctx.interaction.values[0];

    const deleted = await ctx.container.notepadRepository.deleteItem(itemId);
    if (!deleted) {
      await ctx.interaction.update({
        content: '⚠️ O item não foi encontrado.',
        components: [],
      });
      return;
    }

    const service = new NotepadService(ctx.container);
    await service.refreshListMessage(listId, ctx.interaction.channel as TextChannel);

    await ctx.interaction.update({
      content: `🗑️ Item "${deleted.content}" excluído com sucesso!`,
      components: [],
    });
  },
};

// ==========================================
// SelectMenu: Escolher Item para Abrir Modal de Edição
// ==========================================
export const notepadEditPickSelectHandler: ISelectMenuHandler = {
  customIdPrefix: 'notepad_sel_editpick_',
  execute: async (ctx: SelectMenuContext): Promise<void> => {
    const listId = ctx.interaction.customId.replace('notepad_sel_editpick_', '');
    const itemId = ctx.interaction.values[0];

    const item = await ctx.container.notepadRepository.findItemById(itemId);
    if (!item) {
      await ctx.interaction.update({
        content: '⚠️ O item não foi encontrado.',
        components: [],
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`notepad_modal_edit_${listId}_${itemId}`)
      .setTitle('Editar Item');

    const contentInput = new TextInputBuilder()
      .setCustomId('notepad_input_edit_content')
      .setLabel('Novo Texto do Item')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(item.content)
      .setMinLength(1)
      .setMaxLength(250)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput));
    await ctx.interaction.showModal(modal);
  },
};
