import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import {
  IButtonHandler,
  ICommand,
  IContextMenuCommand,
  IModalHandler,
  ISelectMenuHandler,
} from '../types/index.js';
import { Container } from '../core/container.js';

export class CoreBotClient extends Client {
  public commands: Collection<string, ICommand> = new Collection();
  public contextMenuCommands: Collection<string, IContextMenuCommand> = new Collection();
  public buttonHandlers: Collection<string, IButtonHandler> = new Collection();
  public modalHandlers: Collection<string, IModalHandler> = new Collection();
  public selectMenuHandlers: Collection<string, ISelectMenuHandler> = new Collection();
  public container!: Container;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User],
    });
  }

  public setContainer(container: Container): void {
    this.container = container;
  }
}
