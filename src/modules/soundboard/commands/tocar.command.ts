import { SlashCommandBuilder } from 'discord.js';
import { ICommand, CommandContext, AutocompleteContext } from '../../../types/index.js';
import { SoundboardService } from '../services/soundboard.service.js';
import { BotEmbed } from '../../../utils/embed.builder.js';

export const TocarCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('tocar')
    .setDescription('Reproduz um som curto do soundboard no seu canal de voz atual')
    .addStringOption((opt) =>
      opt
        .setName('som')
        .setDescription('Nome do arquivo de som')
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(ctx: AutocompleteContext): Promise<void> {
    const focusedValue = ctx.interaction.options.getFocused().toLowerCase();
    const service = new SoundboardService();
    const available = service.getAvailableSounds();

    const filtered = available
      .filter((s) => s.name.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    await ctx.interaction.respond(
      filtered.map((s) => ({
        name: `${s.name} (${s.extension.toUpperCase()} • ${s.sizeKb} KB)`,
        value: s.name,
      })),
    );
  },

  async execute(ctx: CommandContext): Promise<void> {
    const voiceChannelId = ctx.member.voice.channelId;
    if (!voiceChannelId) {
      await ctx.interaction.reply({
        embeds: [
          BotEmbed.warning(
            'Não Conectado',
            'Você precisa estar conectado a um canal de voz para usar o soundboard!',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const soundName = ctx.interaction.options.getString('som', true);
    const service = new SoundboardService();

    await ctx.interaction.deferReply({ ephemeral: true });

    const result = await service.playSound(ctx.guild, voiceChannelId, soundName);

    if (result.success) {
      await ctx.interaction.editReply({
        embeds: [
          BotEmbed.success(
            '🔊 Soundboard',
            `Reproduzindo **"${result.soundItem?.name}"** no canal <#${voiceChannelId}>!`,
          ),
        ],
      });
    } else {
      await ctx.interaction.editReply({
        embeds: [BotEmbed.error('Soundboard', result.message)],
      });
    }
  },
};
