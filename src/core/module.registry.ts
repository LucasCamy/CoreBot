import { ClientEvents } from 'discord.js';
import { IModule, IEvent } from '../types/index.js';
import { Container } from './container.js';
import { logger } from '../utils/logger.js';
import { GuildGuard } from '../discord/guards/guild.guard.js';

export class ModuleRegistry {
  private modules: Map<string, IModule> = new Map();

  constructor(private readonly container: Container) {}

  public register(module: IModule): void {
    if (this.modules.has(module.name)) {
      logger.warn({ moduleName: module.name }, 'Module is already registered, skipping duplicate');
      return;
    }

    this.modules.set(module.name, module);
    logger.info({ moduleName: module.name }, `Module '${module.name}' registered`);
  }

  public async initAll(): Promise<void> {
    const client = this.container.client;

    for (const [name, module] of this.modules.entries()) {
      try {
        if (module.init) {
          await module.init(this.container);
        }

        // Register Slash Commands
        if (module.commands) {
          for (const cmd of module.commands) {
            client.commands.set(cmd.data.name, cmd);
            logger.debug({ module: name, command: cmd.data.name }, 'Registered command');
          }
        }

        // Register Context Menu Commands
        if (module.contextMenuCommands) {
          for (const ctxCmd of module.contextMenuCommands) {
            client.contextMenuCommands.set(ctxCmd.data.name, ctxCmd);
            logger.debug(
              { module: name, contextMenu: ctxCmd.data.name },
              'Registered context menu command',
            );
          }
        }

        // Register Button Handlers
        if (module.buttonHandlers) {
          for (const btn of module.buttonHandlers) {
            client.buttonHandlers.set(btn.customIdPrefix, btn);
            logger.debug({ module: name, button: btn.customIdPrefix }, 'Registered button handler');
          }
        }

        // Register Modal Handlers
        if (module.modalHandlers) {
          for (const modal of module.modalHandlers) {
            client.modalHandlers.set(modal.customIdPrefix, modal);
            logger.debug({ module: name, modal: modal.customIdPrefix }, 'Registered modal handler');
          }
        }

        // Register Select Menu Handlers
        if (module.selectMenuHandlers) {
          for (const select of module.selectMenuHandlers) {
            client.selectMenuHandlers.set(select.customIdPrefix, select);
            logger.debug(
              { module: name, selectMenu: select.customIdPrefix },
              'Registered select menu handler',
            );
          }
        }

        // Register Events
        if (module.events) {
          for (const evt of module.events) {
            this.bindEvent(evt);
            logger.debug({ module: name, event: evt.name }, 'Registered event listener');
          }
        }

        logger.info({ moduleName: name }, `Module '${name}' initialized successfully`);
      } catch (error) {
        logger.error({ moduleName: name, error }, `Failed to initialize module '${name}'`);
        throw error;
      }
    }
  }

  private bindEvent<K extends keyof ClientEvents>(event: IEvent<K>): void {
    const client = this.container.client;

    // Wrap listener with GuildGuard security if the event carries guild or voice state data
    const handler = async (...args: ClientEvents[K]) => {
      try {
        // Automatically check guild if first arg has a guild or guildId
        const firstArg = args[0] as { guild?: { id: string }; guildId?: string } | undefined;
        const guildId = firstArg?.guild?.id || firstArg?.guildId;

        if (guildId && !GuildGuard.isAllowed(guildId)) {
          return;
        }

        await event.execute(this.container, ...args);
      } catch (error) {
        logger.error({ event: String(event.name), error }, 'Error executing event handler');
      }
    };

    if (event.once) {
      client.once(event.name, handler);
    } else {
      client.on(event.name, handler);
    }
  }

  public getModules(): IModule[] {
    return Array.from(this.modules.values());
  }

  public async shutdownAll(): Promise<void> {
    for (const [name, module] of this.modules.entries()) {
      if (module.shutdown) {
        try {
          await module.shutdown();
          logger.info({ moduleName: name }, `Module '${name}' shutdown complete`);
        } catch (error) {
          logger.error({ moduleName: name, error }, `Error during shutdown of module '${name}'`);
        }
      }
    }
  }
}
