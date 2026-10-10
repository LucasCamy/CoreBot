import { IModule } from '../../types/index.js';
import { webhookCommand } from './commands/webhook.command.js';

export const WebhooksModule: IModule = {
  name: 'webhooks',
  description: 'Recepção de webhooks internos para deploys CI/CD e alertas com criticidade',
  commands: [webhookCommand],
};
