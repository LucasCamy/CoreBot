import { z } from 'zod';

export const createNotepadListSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'O título da lista não pode ser vazio.')
    .max(100, 'O título deve ter no máximo 100 caracteres.'),
  description: z
    .string()
    .trim()
    .max(500, 'A descrição deve ter no máximo 500 caracteres.')
    .optional()
    .nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor hex inválida (ex: #5865F2).')
    .optional()
    .default('#5865F2'),
  isCollaborative: z.boolean().default(true),
});

export const addNotepadItemSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'O item não pode ser vazio.')
    .max(250, 'Cada item pode ter no máximo 250 caracteres.'),
});

export const customizeNotepadListSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'O título da lista não pode ser vazio.')
    .max(100, 'O título deve ter no máximo 100 caracteres.'),
  description: z
    .string()
    .trim()
    .max(500, 'A descrição deve ter no máximo 500 caracteres.')
    .optional()
    .nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor hex inválida (ex: #5865F2).')
    .optional()
    .default('#5865F2'),
});

export type CreateNotepadListInput = z.infer<typeof createNotepadListSchema>;
export type AddNotepadItemInput = z.infer<typeof addNotepadItemSchema>;
export type CustomizeNotepadListInput = z.infer<typeof customizeNotepadListSchema>;
