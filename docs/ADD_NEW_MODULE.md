# 🧩 Guia de Criação de Novos Módulos no CoreBot

A arquitetura do CoreBot foi projetada especificamente para permitir a adição de novas funcionalidades (como Moderação, Tickets, Rankings de XP, Integrações com IA ou APIs externas) sem modificar a lógica central do sistema.

---

## 1. Princípios de Design Obrigatórios

Ao criar um novo módulo, obedeça às seguintes regras arquiteturais:

1. **Isolamento de Domínio**: Todo o código específico do recurso deve residir em `src/modules/<nome-do-modulo>/`.
2. **Sem Acesso Direto ao Prisma no Módulo**: Toda persistência em banco deve passar por um repositório tipado em `src/database/repositories/`.
3. **Sem Envio Direto de Mensagens**: Toda notificação ou mensagem enviada a canais ou usuários deve utilizar `container.notificationService.sendToChannel` ou `container.notificationService.sendDirectMessage`.
4. **Validação Rigorosa**: Parâmetros de entrada devem ser validados com schemas do **Zod**.
5. **Segurança de Servidor**: Comandos administrativos devem declarar `adminOnly: true`.

---

## 2. Estrutura Padrão de um Módulo

Crie a pasta dentro de `src/modules/`:

```text
src/modules/moderacao/
  commands/
    moderation.command.ts
  events/
    message-flag.event.ts (opcional)
  services/
    moderation.service.ts
  schemas/
    moderation.schema.ts
  index.ts
```

---

## 3. Passo a Passo Prático: Criando o Módulo "Moderação"

### Passo 1: Criar o Schema de Validação (`schemas/moderation.schema.ts`)

```typescript
import { z } from 'zod';

export const warnUserSchema = z.object({
  guildId: z.string().min(1),
  targetUserId: z.string().min(1),
  moderatorUserId: z.string().min(1),
  reason: z.string().min(3).max(500),
});

export type WarnUserInput = z.infer<typeof warnUserSchema>;
```

### Passo 2: Criar o Serviço de Negócio (`services/moderation.service.ts`)

```typescript
import { Container } from '../../../core/container.js';
import { BotEmbed } from '../../../utils/embed.builder.js';

export class ModerationService {
  constructor(private readonly container: Container) {}

  public async warnUser(params: {
    guildId: string;
    targetUserId: string;
    moderatorUserId: string;
    reason: string;
    logChannelId?: string;
  }): Promise<void> {
    // 1. Notificar o usuário punido via DM através do serviço central
    await this.container.notificationService.sendDirectMessage({
      guildId: params.guildId,
      module: 'moderation',
      eventType: 'user_warned',
      userId: params.targetUserId,
      embeds: [
        BotEmbed.warning(
          'Você recebeu um aviso',
          `**Motivo:** ${params.reason}\n**Servidor:** Registrado pela moderação.`,
        ),
      ],
    });

    // 2. Se houver canal de logs configurado, notificar a equipe
    if (params.logChannelId) {
      await this.container.notificationService.sendToChannel({
        guildId: params.guildId,
        module: 'moderation',
        eventType: 'mod_log',
        channelId: params.logChannelId,
        embeds: [
          BotEmbed.info(
            'Aviso Aplicado',
            `👤 **Usuário:** <@${params.targetUserId}>\n🛡️ **Moderador:** <@${params.moderatorUserId}>\n📝 **Motivo:** ${params.reason}`,
          ),
        ],
      });
    }
  }
}
```

### Passo 3: Criar o Comando Slash (`commands/moderation.command.ts`)

```typescript
import { SlashCommandBuilder } from 'discord.js';
import { ICommand, CommandContext } from '../../../types/index.js';
import { ModerationService } from '../services/moderation.service.js';
import { BotEmbed } from '../../../utils/embed.builder.js';

export const moderationCommand: ICommand = {
  adminOnly: true, // Garante que apenas moderadores/admins utilizem
  data: new SlashCommandBuilder()
    .setName('avisar')
    .setDescription('Aplica uma advertência formal a um membro')
    .addUserOption((opt) =>
      opt.setName('usuario').setDescription('Membro a ser advertido').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('motivo').setDescription('Motivo da advertência').setRequired(true),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, guildId, member } = ctx;
    const targetUser = interaction.options.getUser('usuario', true);
    const reason = interaction.options.getString('motivo', true);

    const modService = new ModerationService(container);
    await modService.warnUser({
      guildId,
      targetUserId: targetUser.id,
      moderatorUserId: member.id,
      reason,
    });

    await interaction.reply({
      embeds: [
        BotEmbed.success(
          'Advertência Enviada',
          `O usuário <@${targetUser.id}> foi advertido com sucesso pelo motivo: "${reason}".`,
        ),
      ],
      ephemeral: true,
    });
  },
};
```

### Passo 4: Criar o Ponto de Entrada do Módulo (`index.ts`)

```typescript
import { IModule } from '../../types/index.js';
import { moderationCommand } from './commands/moderation.command.js';

export const ModerationModule: IModule = {
  name: 'moderation',
  description: 'Módulo de moderação e auditoria de ações disciplinares',
  commands: [moderationCommand],
  // Opcional: registrar eventos, botões ou schedulers
  // events: [...],
  // buttonHandlers: [...],
};
```

### Passo 5: Registrar o Novo Módulo no Bootstrap (`src/index.ts`)

Abra `src/index.ts` e adicione a importação e registro do novo módulo:

```typescript
import { ModerationModule } from './modules/moderation/index.js';

// No bootstrap:
moduleRegistry.register(ModerationModule);
```

Pronto! Ao iniciar o bot, os novos comandos slash serão registrados e sincronizados automaticamente para as guildas autorizadas.
