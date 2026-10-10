import { SlashCommandBuilder } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { AdminService } from '../services/admin.service.js';

export const botCommand: ICommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Painel de administração, status e configurações do CoreBot')
    // Subcommand: status
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Exibe status do bot, uptime, módulos e infraestrutura'),
    )
    // Subcommand: health
    .addSubcommand((sub) =>
      sub.setName('health').setDescription('Verifica saúde do banco de dados, Redis e latência'),
    )
    // Subcommand: permissoes
    .addSubcommand((sub) =>
      sub
        .setName('permissoes')
        .setDescription('Audita as permissões do bot nos canais configurados'),
    )
    // Subcommand group: config
    .addSubcommandGroup((grp) =>
      grp
        .setName('config')
        .setDescription('Configurações globais do bot para este servidor')
        .addSubcommand((sub) =>
          sub.setName('ver').setDescription('Visualiza as configurações atuais do servidor'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('fuso')
            .setDescription('Define o fuso horário (ex: America/Sao_Paulo)')
            .addStringOption((opt) =>
              opt
                .setName('timezone')
                .setDescription('Identificador IANA de fuso')
                .setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('cargo-admin')
            .setDescription('Adiciona um cargo com permissão administrativa no bot')
            .addRoleOption((opt) =>
              opt.setName('cargo').setDescription('Cargo administrativo').setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('alternar-bot')
            .setDescription('Ativa ou desativa as funções do bot no servidor')
            .addBooleanOption((opt) =>
              opt.setName('ativo').setDescription('Bot ativado?').setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('backup-canal')
            .setDescription('Define o canal privado para envio diário dos backups do banco')
            .addChannelOption((opt) =>
              opt.setName('canal').setDescription('Canal de texto privado').setRequired(true),
            ),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, guild, guildId } = ctx;
    const adminService = new AdminService(container);
    const guildRepo = container.guildRepository;

    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (!group && subcommand === 'status') {
      const health = await adminService.getHealth();
      const uptimeSec = health.uptimeSeconds;
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;

      const embed = BotEmbed.info(
        'CoreBot — Status do Sistema',
        `🤖 **Versão:** 1.0.0\n⏱️ **Uptime:** ${hours}h ${minutes}m ${seconds}s\n📶 **Discord Ping:** ${health.discordWsPingMs}ms\n💾 **Uso de Memória:** ${health.memoryUsageMb} MB\n\n**Infraestrutura:**\n🐘 **PostgreSQL (Prisma):** ${health.database ? '🟢 Conectado' : '🔴 Erro'}\n⚡ **Redis (BullMQ):** ${health.redis ? '🟢 Conectado' : '🔴 Erro'}`,
      );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (!group && subcommand === 'health') {
      const health = await adminService.getHealth();
      const isHealthy = health.status === 'healthy';

      const embed = isHealthy
        ? BotEmbed.success(
            'Sistema Saudável (Healthy)',
            `Todos os subsistemas operando normalmente.\n- Banco de Dados: OK\n- Redis / BullMQ: OK\n- WebSocket Latency: ${health.discordWsPingMs}ms`,
          )
        : BotEmbed.error(
            'Atenção: Degradação Detectada',
            `Status atual: **${health.status.toUpperCase()}**\n- Banco de Dados: ${health.database ? 'OK' : 'FALHA'}\n- Redis: ${health.redis ? 'OK' : 'FALHA'}\n- Discord Latency: ${health.discordWsPingMs}ms`,
          );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (!group && subcommand === 'permissoes') {
      await interaction.deferReply();
      const audit = await adminService.auditGuildPermissions(guild);

      if (audit.length === 0) {
        await interaction.editReply({
          embeds: [
            BotEmbed.info('Auditoria de Permissões', 'Nenhum canal monitorado configurado ainda.'),
          ],
        });
        return;
      }

      const issues = audit.filter((a) => !a.hasAll);
      if (issues.length === 0) {
        await interaction.editReply({
          embeds: [
            BotEmbed.success(
              'Permissões 100% OK',
              `O CoreBot possui todas as permissões necessárias em todos os ${audit.length} canais configurados!`,
            ),
          ],
        });
        return;
      }

      const issuesFormatted = issues
        .map(
          (iss) =>
            `⚠️ **Canal:** <#${iss.channelId}> (${iss.channelName})\n❌ **Faltando:** ${iss.missingPermissions.join(', ')}`,
        )
        .join('\n\n');

      await interaction.editReply({
        embeds: [
          BotEmbed.warning(
            'Permissões Faltantes Detectadas',
            `O bot precisa das seguintes permissões nos canais abaixo:\n\n${issuesFormatted}`,
          ),
        ],
      });
      return;
    }

    if (group === 'config') {
      const config = await guildRepo.getOrCreate(guildId);

      if (subcommand === 'ver') {
        const rolesList =
          config.adminRoleIds.length > 0
            ? config.adminRoleIds.map((r) => `<@&${r}>`).join(', ')
            : '_Nenhum cargo extra configurado (apenas Administradores do Discord)_';

        const backupInfo = config.backupChannelId
          ? `<#${config.backupChannelId}>`
          : '_Não configurado_';

        const embed = BotEmbed.info(
          `Configurações de ${guild.name}`,
          `🌐 **Fuso Horário:** \`${config.timezone}\`\n🔌 **Bot Ativado:** ${config.botEnabled ? '🟢 Sim' : '🔴 Não'}\n💾 **Canal de Backup:** ${backupInfo}\n🛡️ **Cargos Administrativos:** ${rolesList}`,
        );

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (subcommand === 'fuso') {
        const tz = interaction.options.getString('timezone', true);
        await guildRepo.setTimezone(guildId, tz);

        await interaction.reply({
          embeds: [
            BotEmbed.success(
              'Fuso Atualizado',
              `O fuso horário deste servidor foi alterado para \`${tz}\`.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'cargo-admin') {
        const role = interaction.options.getRole('cargo', true);
        const roles = Array.from(new Set([...config.adminRoleIds, role.id]));
        await guildRepo.setAdminRoles(guildId, roles);

        await interaction.reply({
          embeds: [
            BotEmbed.success(
              'Cargo Adicionado',
              `O cargo <@&${role.id}> agora tem privilégios de administrador no CoreBot.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'alternar-bot') {
        const enabled = interaction.options.getBoolean('ativo', true);
        await guildRepo.setBotEnabled(guildId, enabled);

        await interaction.reply({
          embeds: [
            BotEmbed.success(
              'Status Atualizado',
              `O CoreBot foi ${enabled ? '🟢 ATIVADO' : '🔴 DESATIVADO'} neste servidor.`,
            ),
          ],
        });
        return;
      }

      if (subcommand === 'backup-canal') {
        const channel = interaction.options.getChannel('canal', true);
        await guildRepo.setBackupChannel(guildId, channel.id);

        await interaction.reply({
          embeds: [
            BotEmbed.success(
              'Canal de Backup Configurado',
              `O canal <#${channel.id}> foi configurado para receber os backups diários do banco de dados.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }
    }
  },
};
