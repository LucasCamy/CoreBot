import { describe, it, expect } from 'vitest';
import {
  createNotepadListSchema,
  addNotepadItemSchema,
  customizeNotepadListSchema,
} from '../../src/modules/notepad/schemas/notepad.schema.js';
import { NotepadService } from '../../src/modules/notepad/services/notepad.service.js';
import { Container } from '../../src/core/container.js';

describe('Notepad Module (Bloco de Notas & Listas)', () => {
  describe('Schema Validations', () => {
    it('should validate valid list creation data', () => {
      const valid = createNotepadListSchema.safeParse({
        title: 'Metas da Guilda',
        description: 'Tarefas para o evento de fim de semana',
        color: '#2ECC71',
        isCollaborative: true,
      });
      expect(valid.success).toBe(true);
    });

    it('should reject empty title or oversized content', () => {
      const emptyTitle = createNotepadListSchema.safeParse({
        title: '   ',
      });
      expect(emptyTitle.success).toBe(false);

      const invalidItem = addNotepadItemSchema.safeParse({
        content: 'a'.repeat(251),
      });
      expect(invalidItem.success).toBe(false);
    });

    it('should validate customizer schema', () => {
      const custom = customizeNotepadListSchema.safeParse({
        title: 'Nova Lista',
        description: 'Descrição nova',
        color: '#E74C3C',
      });
      expect(custom.success).toBe(true);
    });
  });

  describe('NotepadService Rendering', () => {
    const container = {} as Container;
    const service = new NotepadService(container);

    it('should render empty list with 0% progress and disabled toggle/edit buttons', () => {
      const list = {
        id: 'list-1',
        guildId: 'guild-1',
        channelId: 'channel-1',
        messageId: 'msg-1',
        title: 'Lista Vazia',
        description: null,
        color: '#5865F2',
        isCollaborative: true,
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      const rendered = service.renderList(list);
      expect(rendered.embeds).toHaveLength(1);
      expect(rendered.components).toHaveLength(2);

      const embed = rendered.embeds[0];
      expect(embed.data.title).toContain('Lista Vazia');
      expect(embed.data.description).toContain('**0%** (0 itens)');

      // Toggle, Edit, Delitem buttons should be disabled in row 1
      const row1Buttons = rendered.components[0].components;
      expect(row1Buttons[1].data.disabled).toBe(true); // Concluir
      expect(row1Buttons[2].data.disabled).toBe(true); // Editar
      expect(row1Buttons[3].data.disabled).toBe(true); // Excluir
    });

    it('should render progress bar and items with strikethrough for completed', () => {
      const list = {
        id: 'list-2',
        guildId: 'guild-1',
        channelId: 'channel-1',
        messageId: 'msg-2',
        title: 'Tarefas Ativas',
        description: 'Checklist semanal',
        color: '#2ECC71',
        isCollaborative: false,
        ownerId: 'user-owner',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-1',
            listId: 'list-2',
            content: 'Primeira tarefa pendente',
            isCompleted: false,
            addedByUserId: 'user-1',
            completedByUserId: null,
            position: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'item-2',
            listId: 'list-2',
            content: 'Segunda tarefa concluída',
            isCompleted: true,
            addedByUserId: 'user-1',
            completedByUserId: 'user-completer',
            position: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const rendered = service.renderList(list);
      const embed = rendered.embeds[0];

      expect(embed.data.description).toContain('50%');
      expect(embed.data.description).toContain('(1/2)');
      expect(embed.data.description).toContain('⬜ **1.** Primeira tarefa pendente');
      expect(embed.data.description).toContain('✅ ~~**2.** Segunda tarefa concluída~~');
      expect(embed.data.description).toContain('🔒 **Modo:** Pessoal');

      const row1Buttons = rendered.components[0].components;
      expect(row1Buttons[1].data.disabled).toBe(false); // Concluir habilitado
    });
  });
});
