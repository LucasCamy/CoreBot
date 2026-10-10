import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ICommand, CommandContext, AutocompleteContext } from '../../../types/index.js';
import { SoundboardService } from '../services/soundboard.service.js';
import { BOT_COLORS, BOT_EMOJIS } from '../../../config/constants.js';
import { PermissionGuard } from '../../../discord/guards/permission.guard.js';
import { BotEmbed } from '../../../utils/embed.builder.js';

export const SonsCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('sons')
    .setDescription('Gerencia e lista os áudios disponíveis no soundboard')
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista todos os áudios disponíveis para reprodução'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('upload')
        .setDescription('Envia um novo áudio para o soundboard (.mp3, .ogg ou .wav, máx 8 MB)')
        .addStringOption((opt) =>
          opt
            .setName('nome')
            .setDescription(
              'Nome de identificação do som (apenas letras, números, hífen e underline)',
            )
            .setRequired(true),
        )
        .addAttachmentOption((opt) =>
          opt
            .setName('anexo')
            .setDescription('Arquivo de áudio (.mp3, .ogg ou .wav até 8 MB)')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove um áudio existente do soundboard')
        .addStringOption((opt) =>
          opt
            .setName('nome')
            .setDescription('Nome do som a ser removido')
            .setRequired(true)
            .setAutocomplete(true),
        ),
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
    const sub = ctx.interaction.options.getSubcommand();
    const service = new SoundboardService();

    // 1. List sounds
    if (sub === 'listar') {
      const sounds = service.getAvailableSounds();

      const embed = new EmbedBuilder()
        .setColor(BOT_COLORS.PRIMARY)
        .setTitle(`${BOT_EMOJIS.SOUND} Soundboard do Servidor (${sounds.length} áudios)`)
        .setFooter({ text: 'Use /tocar <nome> enquanto estiver em um canal de voz' });

      if (sounds.length === 0) {
        embed.setDescription(
          '*Nenhum som encontrado na pasta `assets/sounds`. Administradores podem usar `/sons upload` para adicionar!',
        );
      } else {
        const listText = sounds
          .map((s) => `• **\`${s.name}\`** — \`${s.extension.toUpperCase()}\` (${s.sizeKb} KB)`)
          .join('\n');

        embed.setDescription(
          `Aqui estão os sons gravados e disponíveis para tocar em chamada:\n\n${listText}\n\n💡 *Para tocar, digite:* \`/tocar som:${sounds[0]?.name || 'bruh'}\``,
        );
      }

      await ctx.interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // 2. Upload sound (Requires Admin)
    if (sub === 'upload') {
      const isAdmin = await PermissionGuard.isAdmin(ctx.member, ctx.container);
      if (!isAdmin) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.error(
              'Permissão Negada',
              'Apenas administradores podem fazer upload de novos arquivos para o soundboard.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const name = ctx.interaction.options.getString('nome', true);
      const attachment = ctx.interaction.options.getAttachment('anexo', true);

      await ctx.interaction.deferReply({ ephemeral: true });

      const result = await service.uploadSound(
        name,
        attachment.url,
        attachment.name,
        attachment.size,
        attachment.contentType,
      );

      if (result.success) {
        await ctx.interaction.editReply({
          embeds: [
            BotEmbed.success(
              'Som Adicionado',
              `${result.message}\n\nAgora você já pode usá-lo com: \`/tocar som:${result.soundItem?.name}\``,
            ),
          ],
        });
      } else {
        await ctx.interaction.editReply({
          embeds: [BotEmbed.error('Falha no Upload', result.message)],
        });
      }
      return;
    }

    // 3. Remove sound (Requires Admin)
    if (sub === 'remover') {
      const isAdmin = await PermissionGuard.isAdmin(ctx.member, ctx.container);
      if (!isAdmin) {
        await ctx.interaction.reply({
          embeds: [
            BotEmbed.error(
              'Permissão Negada',
              'Apenas administradores podem remover arquivos de som do soundboard.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const name = ctx.interaction.options.getString('nome', true);
      const result = service.deleteSound(name);

      if (result.success) {
        await ctx.interaction.reply({
          embeds: [BotEmbed.success('Som Removido', result.message)],
          ephemeral: true,
        });
      } else {
        await ctx.interaction.reply({
          embeds: [BotEmbed.error('Erro na Remoção', result.message)],
          ephemeral: true,
        });
      }
    }
  },
};
