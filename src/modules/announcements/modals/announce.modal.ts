import { IModalHandler, ModalContext } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { AnnounceService } from '../services/announce.service.js';

export const announceModalHandler: IModalHandler = {
  customIdPrefix: 'announce_modal',
  execute: async (ctx: ModalContext): Promise<void> => {
    const { interaction, guild } = ctx;
    // customId format: "announce_modal:<channelId>"
    const parts = interaction.customId.split(':');
    const channelId = parts[1];

    if (!channelId) {
      await interaction.reply({
        embeds: [BotEmbed.error('Erro no Modal', 'Identificador de canal ausente.')],
        ephemeral: true,
      });
      return;
    }

    const title = interaction.fields.getTextInputValue('announce_title')?.trim();
    const content = interaction.fields.getTextInputValue('announce_content')?.trim();
    const color = interaction.fields.getTextInputValue('announce_color')?.trim();
    const image = interaction.fields.getTextInputValue('announce_image')?.trim();

    if (!content) {
      await interaction.reply({
        embeds: [
          BotEmbed.error('Conteúdo Obrigatório', 'Você deve preencher o texto da mensagem.'),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const service = new AnnounceService();
    const result = await service.sendEmbedMessage(guild, channelId, {
      title: title && title.length > 0 ? title : undefined,
      description: content,
      color: color && color.length > 0 ? color : undefined,
      imageUrl: image && image.length > 0 ? image : undefined,
    });

    if (!result.success || !result.data) {
      await interaction.editReply({
        embeds: [
          BotEmbed.error(
            'Falha ao Publicar Anúncio',
            result.error || 'Ocorreu um erro ao enviar para o canal selecionado.',
          ),
        ],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        BotEmbed.success(
          'Anúncio Publicado com Sucesso!',
          `📢 Sua mensagem foi enviada para o canal <#${channelId}>!\n\n🔗 **ID da Mensagem:** \`${result.data.messageId}\``,
        ),
      ],
    });
  },
};
