import { IModule } from '../../types/index.js';
import { QuoteCommand } from './commands/quote.command.js';
import { SaveQuoteContextMenu } from './context-menus/save-quote.context.js';
import { QuotePaginationButtonHandler } from './buttons/quote-pagination.button.js';
import { Container } from '../../core/container.js';

let schedulerInstance: { stop(): void } | null = null;

export const QuotesModule: IModule = {
  name: 'quotes',
  description: 'Pérolas & Citações memoráveis do servidor com sorteio semanal',
  commands: [QuoteCommand],
  contextMenuCommands: [SaveQuoteContextMenu],
  buttonHandlers: [QuotePaginationButtonHandler],

  async init(container: Container): Promise<void> {
    if (container.quotesScheduler) {
      await container.quotesScheduler.start();
      schedulerInstance = container.quotesScheduler;
    }
  },

  async shutdown(): Promise<void> {
    if (schedulerInstance) {
      schedulerInstance.stop();
      schedulerInstance = null;
    }
  },
};
