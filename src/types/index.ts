import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
  ClientEvents,
  Guild,
  GuildMember,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  ContextMenuCommandInteraction,
  ContextMenuCommandBuilder,
  AutocompleteInteraction,
} from 'discord.js';
import { Container } from '../core/container.js';
import { CoreBotClient } from '../discord/client.js';

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder
  | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  client: CoreBotClient;
  container: Container;
  guild: Guild;
  member: GuildMember;
  guildId: string;
}

export interface ButtonContext {
  interaction: ButtonInteraction;
  client: CoreBotClient;
  container: Container;
  guild: Guild;
  member: GuildMember;
  guildId: string;
}

export interface ModalContext {
  interaction: ModalSubmitInteraction;
  client: CoreBotClient;
  container: Container;
  guild: Guild;
  member: GuildMember;
  guildId: string;
}

export interface SelectMenuContext {
  interaction: AnySelectMenuInteraction;
  client: CoreBotClient;
  container: Container;
  guild: Guild;
  member: GuildMember;
  guildId: string;
}

export interface ContextMenuContext {
  interaction: ContextMenuCommandInteraction;
  client: CoreBotClient;
  container: Container;
  guild: Guild;
  member: GuildMember;
  guildId: string;
}

export interface AutocompleteContext {
  interaction: AutocompleteInteraction;
  client: CoreBotClient;
  container: Container;
  guild: Guild;
  member: GuildMember;
  guildId: string;
}

export interface ICommand {
  data: SlashCommandData;
  adminOnly?: boolean;
  execute(ctx: CommandContext): Promise<void>;
  autocomplete?(ctx: AutocompleteContext): Promise<void>;
}

export interface IContextMenuCommand {
  data: ContextMenuCommandBuilder;
  adminOnly?: boolean;
  execute(ctx: ContextMenuContext): Promise<void>;
}

export interface IButtonHandler {
  customIdPrefix: string;
  execute(ctx: ButtonContext): Promise<void>;
}

export interface IModalHandler {
  customIdPrefix: string;
  execute(ctx: ModalContext): Promise<void>;
}

export interface ISelectMenuHandler {
  customIdPrefix: string;
  execute(ctx: SelectMenuContext): Promise<void>;
}

export interface IEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(container: Container, ...args: ClientEvents[K]): Promise<void>;
}

export interface IModule {
  name: string;
  description: string;
  commands?: ICommand[];
  contextMenuCommands?: IContextMenuCommand[];
  events?: IEvent[];
  buttonHandlers?: IButtonHandler[];
  modalHandlers?: IModalHandler[];
  selectMenuHandlers?: ISelectMenuHandler[];
  init?(container: Container): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface SendNotificationOptions {
  guildId: string;
  module: string;
  eventType: string;
  targetChannelId?: string;
  targetUserId?: string;
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
  files?: unknown[];
}
