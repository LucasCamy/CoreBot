import { EmbedBuilder } from 'discord.js';
import { BOT_COLORS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export interface TemplateContext {
  user?: string;
  userMention?: string;
  username?: string;
  channel?: string;
  channelMention?: string;
  server?: string;
  time?: string;
  date?: string;
  idade?: string | number;
  [key: string]: string | number | undefined;
}

export interface RenderedMessage {
  content?: string;
  embeds?: EmbedBuilder[];
}

export class MessageTemplateService {
  /**
   * Replace all placeholders matching {key} with values from context
   */
  public renderText(template: string, context: TemplateContext): string {
    if (!template) return '';

    try {
      return template.replace(/\{(\w+)\}/g, (match, key: string) => {
        const val = context[key];
        return val !== undefined && val !== null ? String(val) : match;
      });
    } catch (error) {
      logger.error({ error, template }, 'Failed to render message template text, using fallback');
      return template;
    }
  }

  /**
   * Render either plain text message or embed message based on configuration
   */
  public renderMessage(
    template: string,
    context: TemplateContext,
    options: {
      useEmbed?: boolean;
      embedTitle?: string;
      embedColor?: string | number | null;
      fallbackText?: string;
    } = {},
  ): RenderedMessage {
    try {
      const renderedContent = this.renderText(template, context);

      if (options.useEmbed) {
        let colorNum: number = BOT_COLORS.PRIMARY;
        if (typeof options.embedColor === 'string' && options.embedColor.startsWith('#')) {
          colorNum = parseInt(options.embedColor.replace('#', ''), 16);
        } else if (typeof options.embedColor === 'number') {
          colorNum = options.embedColor;
        }

        const embed = new EmbedBuilder()
          .setColor(colorNum)
          .setDescription(renderedContent)
          .setTimestamp();

        if (options.embedTitle) {
          embed.setTitle(this.renderText(options.embedTitle, context));
        }

        return { embeds: [embed] };
      }

      return { content: renderedContent };
    } catch (error) {
      logger.error({ error, template }, 'Error rendering message, using safe fallback');
      const fallback = options.fallbackText || template || 'Notificação do sistema.';
      return { content: fallback };
    }
  }

  /**
   * Validate that placeholder names in a template string are valid known variables
   */
  public validatePlaceholders(
    template: string,
    allowedPlaceholders: string[],
  ): { valid: boolean; invalidPlaceholders: string[] } {
    const matches = Array.from(template.matchAll(/\{(\w+)\}/g));
    const invalidPlaceholders: string[] = [];

    for (const match of matches) {
      const key = match[1];
      if (!allowedPlaceholders.includes(key)) {
        invalidPlaceholders.push(key);
      }
    }

    return {
      valid: invalidPlaceholders.length === 0,
      invalidPlaceholders,
    };
  }
}
