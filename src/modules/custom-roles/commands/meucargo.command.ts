import { SlashCommandBuilder } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { CustomRoleService } from '../services/custom-role.service.js';
import { PermissionGuard } from '../../../discord/guards/permission.guard.js';

export const meuCargoCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('meucargo')
    .setDescription('Cria e gerencia seu cargo estético personalizado exclusivo')
    // Subcommand: criar
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Cria e aplica seu cargo estético personalizado')
        .addStringOption((opt) =>
          opt.setName('nome').setDescription('Nome do seu cargo personalizado').setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('cor')
            .setDescription('Cor em formato hexadecimal (ex: #FF5733, #5865F2)')
            .setRequired(true),
        ),
    )
    // Subcommand: cor
    .addSubcommand((sub) =>
      sub
        .setName('cor')
        .setDescription('Atualiza a cor do seu cargo personalizado')
        .addStringOption((opt) =>
          opt
            .setName('cor')
            .setDescription('Nova cor em hexadecimal (ex: #57F287)')
            .setRequired(true),
        ),
    )
    // Subcommand: nome
    .addSubcommand((sub) =>
      sub
        .setName('nome')
        .setDescription('Atualiza o nome do seu cargo personalizado')
        .addStringOption((opt) =>
          opt.setName('novo_nome').setDescription('Novo nome do cargo').setRequired(true),
        ),
    )
    // Subcommand: remover
    .addSubcommand((sub) =>
      sub.setName('remover').setDescription('Exclui permanentemente o seu cargo personalizado'),
    )
    // Subcommand: admin-config
    .addSubcommand((sub) =>
      sub
        .setName('admin-config')
        .setDescription('(Admin) Configura regras do sistema de cargos personalizados')
        .addRoleOption((opt) =>
          opt
            .setName('cargo_ancora')
            .setDescription('Cargo âncora (novos cargos ficarão abaixo dele)'),
        )
        .addRoleOption((opt) =>
          opt.setName('cargo_permitido').setDescription('Cargo com permissão para usar o comando'),
        )
        .addBooleanOption((opt) =>
          opt.setName('ativo').setDescription('Ativar ou desativar o sistema no servidor'),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, guild, member, guildId } = ctx;
    const service = new CustomRoleService(container);
    const repo = container.customRoleRepository;
    const subcommand = interaction.options.getSubcommand();

    // 1. Subcomando Administrativo: admin-config
    if (subcommand === 'admin-config') {
      const isAdmin = await PermissionGuard.isAdmin(member, container);
      if (!isAdmin) {
        await interaction.reply({
          embeds: [
            BotEmbed.error(
              'Permissão Negada',
              'Apenas administradores podem configurar o sistema de cargos.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const anchorRole = interaction.options.getRole('cargo_ancora');
      const allowedRole = interaction.options.getRole('cargo_permitido');
      const active = interaction.options.getBoolean('ativo');

      const existingConfig = await repo.getConfig(guildId);
      let allowedRoleIds = existingConfig?.allowedRoleIds ?? [];

      if (allowedRole) {
        allowedRoleIds = Array.from(new Set([...allowedRoleIds, allowedRole.id]));
      }

      const updated = await repo.upsertConfig(guildId, {
        anchorRoleId: anchorRole ? anchorRole.id : existingConfig?.anchorRoleId,
        allowedRoleIds,
        enabled: active !== null ? active : (existingConfig?.enabled ?? true),
      });

      const anchorDesc = updated.anchorRoleId ? `<@&${updated.anchorRoleId}>` : '_Não definido_';
      const allowedDesc =
        updated.allowedRoleIds.length > 0
          ? updated.allowedRoleIds.map((id) => `<@&${id}>`).join(', ')
          : '_Todos os membros (ou nenhum filtro ativo)_';

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Configurações de Cargos Personalizados',
            `⚙️ **Status do Sistema:** ${updated.enabled ? '🟢 Ativado' : '🔴 Desativado'}\n⚓ **Cargo Âncora:** ${anchorDesc}\n👥 **Cargos Permitidos:** ${allowedDesc}`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // 2. Subcomando: criar
    if (subcommand === 'criar') {
      const name = interaction.options.getString('nome', true);
      const color = interaction.options.getString('cor', true);

      await interaction.deferReply({ ephemeral: true });
      const result = await service.createRole(member, name, color);

      if (!result.success || !result.data) {
        await interaction.editReply({
          embeds: [
            BotEmbed.error('Não Foi Possível Criar o Cargo', result.error || 'Erro desconhecido.'),
          ],
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          BotEmbed.success(
            'Cargo Personalizado Criado!',
            `🎉 Seu cargo foi criado e atribuído ao seu perfil com sucesso!\n\n🏷️ **Nome:** \`${result.data.name}\`\n🎨 **Cor:** \`${result.data.color}\`\n👑 **Cargo:** <@&${result.data.roleId}>`,
          ),
        ],
      });
      return;
    }

    // 3. Subcomando: cor
    if (subcommand === 'cor') {
      const color = interaction.options.getString('cor', true);

      await interaction.deferReply({ ephemeral: true });
      const result = await service.updateColor(member, color);

      if (!result.success || !result.data) {
        await interaction.editReply({
          embeds: [BotEmbed.error('Erro ao Atualizar Cor', result.error || 'Erro desconhecido.')],
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          BotEmbed.success(
            'Cor do Cargo Atualizada!',
            `🎨 A cor do seu cargo <@&${result.data.roleId}> foi alterada para \`${result.data.color}\`.`,
          ),
        ],
      });
      return;
    }

    // 4. Subcomando: nome
    if (subcommand === 'nome') {
      const newName = interaction.options.getString('novo_nome', true);

      await interaction.deferReply({ ephemeral: true });
      const result = await service.updateName(member, newName);

      if (!result.success || !result.data) {
        await interaction.editReply({
          embeds: [BotEmbed.error('Erro ao Atualizar Nome', result.error || 'Erro desconhecido.')],
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          BotEmbed.success(
            'Nome do Cargo Atualizado!',
            `🏷️ O nome do seu cargo foi alterado para **${result.data.name}** (<@&${result.data.roleId}>).`,
          ),
        ],
      });
      return;
    }

    // 5. Subcomando: remover
    if (subcommand === 'remover') {
      await interaction.deferReply({ ephemeral: true });
      const result = await service.deleteRole(guild, member.id);

      if (!result.success) {
        await interaction.editReply({
          embeds: [BotEmbed.error('Erro ao Remover Cargo', result.error || 'Erro desconhecido.')],
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          BotEmbed.success(
            'Cargo Personalizado Removido',
            'Seu cargo personalizado foi excluído do Discord e desvinculado da sua conta com sucesso.',
          ),
        ],
      });
    }
  },
};
