import { z } from 'zod';

export const hexColorRegex = /^#[0-9A-F]{6}$/i;

export const createCustomRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'O nome do cargo deve ter pelo menos 1 caractere')
    .max(50, 'O nome do cargo pode ter no máximo 50 caracteres')
    .refine((n) => !n.includes('@') && !n.includes('#'), {
      message: 'O nome do cargo não pode conter os caracteres "@" ou "#"',
    }),
  color: z
    .string()
    .trim()
    .regex(hexColorRegex, 'A cor deve estar em formato hexadecimal válido (ex: #FF5733)'),
});

export const updateColorSchema = z.object({
  color: z
    .string()
    .trim()
    .regex(hexColorRegex, 'A cor deve estar em formato hexadecimal válido (ex: #5865F2)'),
});

export const updateNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'O nome do cargo deve ter pelo menos 1 caractere')
    .max(50, 'O nome do cargo pode ter no máximo 50 caracteres')
    .refine((n) => !n.includes('@') && !n.includes('#'), {
      message: 'O nome do cargo não pode conter os caracteres "@" ou "#"',
    }),
});

export type CreateCustomRoleInput = z.infer<typeof createCustomRoleSchema>;
