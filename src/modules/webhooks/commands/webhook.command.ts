import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { CommandContext, ICommand } from '../../../types/index.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { WebhookService } from '../services/webhook.service.js';

export const webhookCommand: ICommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('webhook')
    .setDescription('Gerencia e monitora os endpoints de webhooks internos para CI/CD e alertas')
    // Subcommand: canais
    .addSubcommand((sub) =>
      sub
        .setName('canais')
        .setDescription('Configura os canais de destino para deploys e alertas')
        .addChannelOption((opt) =>
          opt
            .setName('canal_deploy')
            .setDescription('Canal para avisos de deploy de CI/CD')
            .addChannelTypes(ChannelType.GuildText),
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal_alertas')
            .setDescription('Canal para avisos de monitoramento (Uptime / Prometheus)')
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    // Subcommand: status
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Visualiza os canais configurados e dados dos endpoints'),
    )
    // Subcommand: testar-deploy
    .addSubcommand((sub) =>
      sub.setName('testar-deploy').setDescription('Dispara uma simulação de webhook de deploy'),
    )
    // Subcommand: testar-alerta
    .addSubcommand((sub) =>
      sub
        .setName('testar-alerta')
        .setDescription('Dispara uma simulação de alerta de infraestrutura')
        .addStringOption((opt) =>
          opt
            .setName('criticidade')
            .setDescription('Nível de criticidade do alerta')
            .setRequired(true)
            .addChoices(
              { name: 'Info', value: 'INFO' },
              { name: 'Aviso (Warn)', value: 'WARN' },
              { name: 'Crítico (Critical)', value: 'CRITICAL' },
            ),
        ),
    ),

  execute: async (ctx: CommandContext): Promise<void> => {
    const { interaction, container, guildId } = ctx;
    const webhookRepo = container.webhookRepository;
    const webhookService = new WebhookService(container);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'canais') {
      const deployChannel = interaction.options.getChannel('canal_deploy');
      const alertsChannel = interaction.options.getChannel('canal_alertas');

      if (!deployChannel && !alertsChannel) {
        await interaction.reply({
          embeds: [BotEmbed.error('Ação Inválida', 'Informe ao menos um canal para atualizar.')],
          ephemeral: true,
        });
        return;
      }

      const existing = await webhookRepo.findByGuild(guildId);
      await webhookRepo.update(guildId, {
        deployChannelId: deployChannel ? deployChannel.id : existing?.deployChannelId,
        alertsChannelId: alertsChannel ? alertsChannel.id : existing?.alertsChannelId,
      });

      await interaction.reply({
        embeds: [
          BotEmbed.success(
            'Canais de Webhook Atualizados!',
            `📦 **Canal de Deploy:** ${deployChannel ? `<#${deployChannel.id}>` : existing?.deployChannelId ? `<#${existing.deployChannelId}>` : '_Não definido_'}\n🚨 **Canal de Alertas:** ${alertsChannel ? `<#${alertsChannel.id}>` : existing?.alertsChannelId ? `<#${existing.alertsChannelId}>` : '_Não definido_'}`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'status') {
      const config = await webhookRepo.findByGuild(guildId);
      const deployCh = config?.deployChannelId
        ? `<#${config.deployChannelId}>`
        : '_Não configurado_';
      const alertsCh = config?.alertsChannelId
        ? `<#${config.alertsChannelId}>`
        : '_Não configurado_';

      const desc = `**Canais Vinculados:**\n📦 Deploy: ${deployCh}\n🚨 Alertas: ${alertsCh}\n\n**Endpoints HTTP Ativos:**\n- \`POST /api/webhooks/deploy\`\n- \`POST /api/webhooks/alerts\`\n\n**Autenticação Obrigatória:**\nHeader: \`X-Webhook-Token: <WEBHOOK_SECRET>\``;

      await interaction.reply({
        embeds: [BotEmbed.info('Status dos Webhooks Internos', desc)],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'testar-deploy') {
      await interaction.deferReply({ ephemeral: true });

      const res = await webhookService.processDeploy({
        repository: { full_name: 'corebot/infra-production' },
        ref: 'refs/heads/main',
        head_commit: {
          message: 'feat(core): implement high-impact architectural enhancements',
          author: { name: 'CoreBot Architect' },
          url: 'https://github.com',
        },
        status: 'success',
        environment: 'Production',
      });

      if (res.success) {
        await interaction.editReply({
          embeds: [
            BotEmbed.success(
              'Teste de Deploy Enviado',
              'A notificação foi despachada para o canal configurado!',
            ),
          ],
        });
      } else {
        await interaction.editReply({
          embeds: [BotEmbed.error('Erro no Teste', res.message)],
        });
      }
      return;
    }

    if (subcommand === 'testar-alerta') {
      const severity = interaction.options.getString('criticidade', true) as
        'INFO' | 'WARN' | 'CRITICAL';
      await interaction.deferReply({ ephemeral: true });

      const res = await webhookService.processAlert({
        title: 'CPU Usage Spiked above 90%',
        severity,
        description:
          'Uso de CPU do cluster ultrapassou o limiar de segurança nos últimos 5 minutos.',
      });

      if (res.success) {
        await interaction.editReply({
          embeds: [
            BotEmbed.success(
              'Teste de Alerta Enviado',
              `Alerta de nível **${severity}** despachado com sucesso.`,
            ),
          ],
        });
      } else {
        await interaction.editReply({
          embeds: [BotEmbed.error('Erro no Teste', res.message)],
        });
      }
    }
  },
};
