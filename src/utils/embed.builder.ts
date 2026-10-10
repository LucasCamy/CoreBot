import { EmbedBuilder } from 'discord.js';
import { BOT_COLORS, BOT_EMOJIS } from '../config/constants.js';

export class BotEmbed {
  public static success(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(BOT_COLORS.SUCCESS)
      .setTitle(`${BOT_EMOJIS.SUCCESS} ${title}`)
      .setTimestamp();
    if (description) embed.setDescription(description);
    return embed;
  }

  public static error(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(BOT_COLORS.DANGER)
      .setTitle(`${BOT_EMOJIS.ERROR} ${title}`)
      .setTimestamp();
    if (description) embed.setDescription(description);
    return embed;
  }

  public static warning(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(BOT_COLORS.WARNING)
      .setTitle(`${BOT_EMOJIS.WARNING} ${title}`)
      .setTimestamp();
    if (description) embed.setDescription(description);
    return embed;
  }

  public static info(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(BOT_COLORS.PRIMARY)
      .setTitle(`${BOT_EMOJIS.INFO} ${title}`)
      .setTimestamp();
    if (description) embed.setDescription(description);
    return embed;
  }

  public static custom(
    title: string,
    description: string,
    color: number = BOT_COLORS.PRIMARY,
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }
}
