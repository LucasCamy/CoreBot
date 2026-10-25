import {
  ActionRowBuilder,
  ChannelType,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { AnnounceService } from '../services/announce.service.js';

export const announceCommand: ICommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('anunciar')
    .setDescription('Envia comunicados, mensagens e regras formatadas no servidor como o bot')
    // Subcommand: mensagem (texto puro)
    .addSubcommand((sub) =>
      sub
        .setName('mensagem')
        .setDescription('Envia uma mensagem de texto simples como o bot')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal de destino')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('conteudo')
            .setDescription('Texto da mensagem (suporta formatação Markdown)')
            .setRequired(true),
        ),
    )
    // Subcommand: embed (estilizado)
    .addSubcommand((sub) =>
      sub
        .setName('embed')
        .setDescription('Envia uma mensagem em formato de Embed estilizado')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal de destino')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('conteudo')
            .setDescription('Conteúdo principal da mensagem/regras (use \\n para quebra de linha)')
            .setRequired(true),
        )
        .addStringOption((opt) => opt.setName('titulo').setDescription('Título do anúncio/regras'))
        .addStringOption((opt) =>
          opt.setName('cor').setDescription('Cor em hexadecimal (ex: #FF5733, #5865F2)'),
        )
        .addStringOption((opt) =>
          opt.setName('imagem').setDescription('URL de uma imagem ou banner para o anúncio'),
        )
        .addStringOption((opt) =>
          opt.setName('miniatura').setDescription('URL de um ícone ou miniatura'),
        )
        .addStringOption((opt) =>
          opt.setName('rodape').setDescription('Texto para o rodapé do embed'),
        ),
    )
    // Subcommand: modal (janela pop-up para textos longos como regras)
    .addSubcommand((sub) =>
      sub
        .setName('modal')
        .setDescription('Abre uma janela pop-up para redigir regras ou anúncios longos')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal de destino para o comunicado')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    // Subcommand: editar (alterar mensagem do bot existente)
    .addSubcommand((sub) =>
      sub
        .setName('editar')
        .setDescription('Edita uma mensagem previamente enviada pelo bot')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal onde a mensagem está localizada')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('id_mensagem')
            .setDescription('ID da mensagem enviada pelo bot')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('novo_conteudo').setDescription('Novo texto ou nova descrição do embed'),
        )
        .addStringOption((opt) =>
          opt.setName('novo_titulo').setDescription('Novo título (se for embed)'),
        )
        .addStringOption((opt) =>
          opt.setName('nova_cor').setDescription('Nova cor hexadecimal (ex: #5865F2)'),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, guild } = ctx;
    const service = new AnnounceService();
    const subcommand = interaction.options.getSubcommand();

    // 1. Subcomando: modal (Abre janela interativa para textos longos)
    if (subcommand === 'modal') {
      const targetChannel = interaction.options.getChannel('canal', true);

      const modal = new ModalBuilder()
        .setCustomId(`announce_modal:${targetChannel.id}`)
        .setTitle('Publicar Comunicado / Regras');

      const titleInput = new TextInputBuilder()
        .setCustomId('announce_title')
        .setLabel('Título do Comunicado (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: REGRAS DO SERVIDOR • ATENÇÃO')
        .setRequired(false)
        .setMaxLength(256);

      const contentInput = new TextInputBuilder()
        .setCustomId('announce_content')
        .setLabel('Conteúdo / Regras da Mensagem')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          'Digite aqui as regras ou comunicado. Suporta quebras de linha e formatação Discord.',
        )
        .setRequired(true)
        .setMaxLength(4000);

      const colorInput = new TextInputBuilder()
        .setCustomId('announce_color')
        .setLabel('Cor Hexadecimal (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('#FF5733 (Padrão: Laranja Uganda)')
        .setRequired(false)
        .setMaxLength(7);

      const imageInput = new TextInputBuilder()
        .setCustomId('announce_image')
        .setLabel('URL de Imagem / Banner (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://exemplo.com/banner.png')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
      );

      await interaction.showModal(modal);
      return;
    }

    // Para todos os outros subcomandos, defer imediatamente!
    await interaction.deferReply({ ephemeral: true });

    // 2. Subcomando: mensagem (Texto simples)
    if (subcommand === 'mensagem') {
      const targetChannel = interaction.options.getChannel('canal', true);
      const rawContent = interaction.options.getString('conteudo', true);

      // Permite \n literal virar quebra de linha real
      const content = rawContent.replace(/\\n/g, '\n');

      const result = await service.sendPlainMessage(guild, targetChannel.id, content);
      if (!result.success || !result.data) {
        await interaction.editReply({
          embeds: [BotEmbed.error('Erro ao Enviar Mensagem', result.error || 'Erro desconhecido.')],
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          BotEmbed.success(
            'Mensagem Enviada!',
            `Sua mensagem foi publicada no canal <#${targetChannel.id}> com sucesso.\n\n🔗 **ID da Mensagem:** \`${result.data.messageId}\``,
          ),
        ],
      });
      return;
    }

    // 3. Subcomando: embed (Embed estilizado)
    if (subcommand === 'embed') {
      const targetChannel = interaction.options.getChannel('canal', true);
      const rawContent = interaction.options.getString('conteudo', true);
      const title = interaction.options.getString('titulo');
      const color = interaction.options.getString('cor');
      const image = interaction.options.getString('imagem');
      const thumbnail = interaction.options.getString('miniatura');
      const footer = interaction.options.getString('rodape');

      const content = rawContent.replace(/\\n/g, '\n');

      const result = await service.sendEmbedMessage(guild, targetChannel.id, {
        title: title ?? undefined,
        description: content,
        color: color ?? undefined,
        imageUrl: image ?? undefined,
        thumbnailUrl: thumbnail ?? undefined,
        footer: footer ?? undefined,
      });

      if (!result.success || !result.data) {
        await interaction.editReply({
          embeds: [BotEmbed.error('Erro ao Enviar Embed', result.error || 'Erro desconhecido.')],
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          BotEmbed.success(
            'Embed Publicado!',
            `Seu comunicado estilizado foi enviado no canal <#${targetChannel.id}> com sucesso.\n\n🔗 **ID da Mensagem:** \`${result.data.messageId}\``,
          ),
        ],
      });
      return;
    }

    // 4. Subcomando: editar (Editar mensagem existente)
    if (subcommand === 'editar') {
      const targetChannel = interaction.options.getChannel('canal', true);
      const messageId = interaction.options.getString('id_mensagem', true);
      const newContent = interaction.options.getString('novo_conteudo');
      const newTitle = interaction.options.getString('novo_titulo');
      const newColor = interaction.options.getString('nova_cor');

      if (!newContent && !newTitle && !newColor) {
        await interaction.editReply({
          embeds: [
            BotEmbed.error(
              'Parâmetros Ausentes',
              'Informe ao menos um campo para alteração (`novo_conteudo`, `novo_titulo` ou `nova_cor`).',
            ),
          ],
        });
        return;
      }

      const formattedContent = newContent ? newContent.replace(/\\n/g, '\n') : undefined;

      const result = await service.editMessage(guild, targetChannel.id, messageId, {
        content: formattedContent,
        description: formattedContent,
        title: newTitle ?? undefined,
        color: newColor ?? undefined,
      });

      if (!result.success) {
        await interaction.editReply({
          embeds: [BotEmbed.error('Erro ao Editar Mensagem', result.error || 'Erro desconhecido.')],
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          BotEmbed.success(
            'Mensagem Editada com Sucesso!',
            `A mensagem \`${messageId}\` no canal <#${targetChannel.id}> foi atualizada.`,
          ),
        ],
      });
    }
  },
};
