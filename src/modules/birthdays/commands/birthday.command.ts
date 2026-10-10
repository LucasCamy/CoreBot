import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { BirthdayService } from '../services/birthday.service.js';
import { PermissionGuard } from '../../../discord/guards/permission.guard.js';

export const birthdayCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('aniversario')
    .setDescription('Gerencia aniversários e felicitações automáticas')
    // Subcommand: definir
    .addSubcommand((sub) =>
      sub
        .setName('definir')
        .setDescription('Cadastra ou atualiza uma data de aniversário')
        .addStringOption((opt) =>
          opt
            .setName('data')
            .setDescription('Data de nascimento no formato DD/MM/AAAA (ex: 15/05/1998)')
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal_aviso')
            .setDescription('Canal de texto onde a mensagem de parabéns será enviada')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('(Apenas Admin) Definir aniversário de outro membro'),
        )
        .addStringOption((opt) =>
          opt
            .setName('mensagem')
            .setDescription('Mensagem customizada ({userMention}, {idade}, {data})'),
        ),
    )
    // Subcommand: remover
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove o cadastro de aniversário')
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('(Apenas Admin) Remover aniversário de outro membro'),
        ),
    )
    // Subcommand: listar
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista os próximos aniversariantes cadastrados'),
    )
    // Subcommand: configurar
    .addSubcommand((sub) =>
      sub
        .setName('configurar')
        .setDescription('(Admin) Atualiza o canal ou mensagem para todos os aniversariantes')
        .addChannelOption((opt) =>
          opt
            .setName('canal_padrao')
            .setDescription('Novo canal de texto padrão')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    // Subcommand: testar
    .addSubcommand((sub) =>
      sub
        .setName('testar')
        .setDescription('Envia uma simulação da mensagem de aniversário no canal configurado')
        .addUserOption((opt) =>
          opt.setName('usuario').setDescription('Membro a ser testado').setRequired(true),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, guildId, member } = ctx;
    const birthdayRepo = container.birthdayRepository;
    const birthdayService = new BirthdayService(container);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'definir') {
      const dateStr = interaction.options.getString('data', true);
      const channel = interaction.options.getChannel('canal_aviso', true);
      const targetUser = interaction.options.getUser('usuario');
      const customMessage = interaction.options.getString('mensagem');

      let targetUserId = member.id;
      if (targetUser && targetUser.id !== member.id) {
        const isAdmin = await PermissionGuard.isAdmin(member, container);
        if (!isAdmin) {
          await interaction.reply({
            embeds: [
              BotEmbed.error(
                'Permissão Negada',
                'Apenas administradores podem definir aniversários de outros usuários.',
              ),
            ],
            ephemeral: true,
          });
          return;
        }
        targetUserId = targetUser.id;
      }

      const res = await birthdayService.setBirthday({
        guildId,
        userId: targetUserId,
        dateStr,
        announcementChannelId: channel.id,
        customMessage,
      });

      if (!res.success) {
        await interaction.reply({
          embeds: [BotEmbed.error('Erro ao Salvar Aniversário', res.error || 'Falha ao salvar.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Aniversário Configurado!',
            `🎉 Aniversariante: <@${targetUserId}>\n📅 Data: **${dateStr}**\n📢 Canal: <#${channel.id}>`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'remover') {
      const targetUser = interaction.options.getUser('usuario');
      let targetUserId = member.id;

      if (targetUser && targetUser.id !== member.id) {
        const isAdmin = await PermissionGuard.isAdmin(member, container);
        if (!isAdmin) {
          await interaction.reply({
            embeds: [
              BotEmbed.error(
                'Permissão Negada',
                'Apenas administradores podem remover aniversários de terceiros.',
              ),
            ],
            ephemeral: true,
          });
          return;
        }
        targetUserId = targetUser.id;
      }

      const deleted = await birthdayRepo.delete(guildId, targetUserId);
      if (!deleted) {
        await interaction.reply({
          embeds: [
            BotEmbed.error('Não Encontrado', 'Nenhum aniversário cadastrado para este usuário.'),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Removido',
            `O aniversário de <@${targetUserId}> foi removido do sistema.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'listar') {
      const list = await birthdayRepo.listByGuild(guildId);
      if (list.length === 0) {
        await interaction.reply({
          embeds: [BotEmbed.info('Aniversários', 'Nenhum aniversário cadastrado neste servidor.')],
          ephemeral: true,
        });
        return;
      }

      const desc = list
        .map((b, i) => {
          const d = String(b.birthDate.getUTCDate()).padStart(2, '0');
          const m = String(b.birthDate.getUTCMonth() + 1).padStart(2, '0');
          const y = b.birthDate.getUTCFullYear();
          return `**${i + 1}.** <@${b.userId}> — 📅 **${d}/${m}/${y}** (Canal: <#${b.announcementChannelId}>)`;
        })
        .join('\n');

      await interaction.reply({
        embeds: [BotEmbed.info('Aniversariantes Cadastrados', desc)],
      });
      return;
    }

    if (subcommand === 'configurar') {
      const isAdmin = await PermissionGuard.isAdmin(member, container);
      if (!isAdmin) {
        await interaction.reply({
          embeds: [
            BotEmbed.error('Permissão Negada', 'Apenas administradores podem usar este comando.'),
          ],
          ephemeral: true,
        });
        return;
      }

      const channel = interaction.options.getChannel('canal_padrao', true);

      // Bulk update all existing birthdays to point to the new default channel
      await container.prisma.birthdayConfig.updateMany({
        where: { guildId },
        data: { announcementChannelId: channel.id },
      });

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Canal Padrão Atualizado',
            `Todos os aniversários agora serão anunciados em <#${channel.id}>.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'testar') {
      const targetUser = interaction.options.getUser('usuario', true);
      await interaction.deferReply({ ephemeral: true });

      const ok = await birthdayService.triggerTestGreeting(guildId, targetUser.id);
      if (ok) {
        await interaction.editReply({
          embeds: [
            BotEmbed.success(
              'Teste Enviado',
              `A mensagem simulada de aniversário para <@${targetUser.id}> foi enviada no canal cadastrado!`,
            ),
          ],
        });
      } else {
        await interaction.editReply({
          embeds: [
            BotEmbed.error(
              'Erro no Teste',
              'O usuário não possui aniversário cadastrado ou o bot não tem acesso ao canal.',
            ),
          ],
        });
      }
    }
  },
};
