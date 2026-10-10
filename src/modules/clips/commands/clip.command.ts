import { SlashCommandBuilder } from 'discord.js';
import { ICommand, CommandContext } from '../../../types/index.js';
import { ClipService } from '../services/clip.service.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { buildClipVoteRow } from '../buttons/clip-vote.button.js';
import { createClipSchema } from '../schemas/clip.schema.js';

export const ClipCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('clip')
    .setDescription('Catálogo comunitário de clipes e jogadas memoráveis')
    .addSubcommand((sub) =>
      sub
        .setName('salvar')
        .setDescription('Registra um clipe da galera com botões interativos de voto')
        .addStringOption((opt) =>
          opt
            .setName('titulo')
            .setDescription('Título ou legenda do momento/jogada')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('url')
            .setDescription('Link do clipe (Medal, YouTube, Twitch, etc.)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('jogo').setDescription('Jogo relacionado (opcional)').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('top')
        .setDescription('Exibe os clipes mais votados do servidor')
        .addStringOption((opt) =>
          opt.setName('jogo').setDescription('Filtrar por jogo (opcional)').setRequired(false),
        ),
    ),

  async execute(ctx: CommandContext): Promise<void> {
    const sub = ctx.interaction.options.getSubcommand();
    const service = new ClipService(ctx.container);

    if (sub === 'salvar') {
      const title = ctx.interaction.options.getString('titulo', true);
      const url = ctx.interaction.options.getString('url', true);
      const game = ctx.interaction.options.getString('jogo', false);

      const validation = createClipSchema.safeParse({ title, url, game });
      if (!validation.success) {
        await ctx.interaction.reply({
          embeds: [BotEmbed.error('Link ou Dados Inválidos', validation.error.errors[0].message)],
          ephemeral: true,
        });
        return;
      }

      const clip = await service.saveClip({
        guildId: ctx.guildId,
        title,
        url,
        game,
        submitterId: ctx.member.id,
        channelId: ctx.interaction.channelId,
      });

      const embed = service.buildClipEmbed(clip);
      const row = buildClipVoteRow(clip);

      const message = await ctx.interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true,
      });

      await service.updateMessageId(clip.id, message.id);
      return;
    }

    if (sub === 'top') {
      const gameFilter = ctx.interaction.options.getString('jogo', false);
      const clips = await service.getTopClips(ctx.guildId, gameFilter, 5);

      const embed = service.buildTopClipsEmbed(clips, gameFilter);
      await ctx.interaction.reply({ embeds: [embed] });
      return;
    }
  },
};
