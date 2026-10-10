import { Container } from '../../../core/container.js';
import { BotEmbed } from '../../../utils/embed.builder.js';
import { BOT_COLORS } from '../../../config/constants.js';
import { logger } from '../../../utils/logger.js';

export interface GenericDeployPayload {
  repository?: { name?: string; full_name?: string };
  project?: { name?: string };
  repo?: string;
  ref?: string;
  branch?: string;
  commit?: string;
  head_commit?: { message?: string; author?: { name?: string }; url?: string };
  sender?: { login?: string };
  author?: string;
  status?: string;
  environment?: string;
  url?: string;
  [key: string]: unknown;
}

export interface GenericAlertPayload {
  title?: string;
  name?: string;
  service?: string;
  severity?: 'INFO' | 'WARN' | 'CRITICAL' | string;
  status?: string;
  message?: string;
  description?: string;
  heartbeat?: { name?: string; status?: number; msg?: string; time?: string };
  alerts?: Array<{
    status?: string;
    labels?: { alertname?: string; severity?: string; instance?: string };
    annotations?: { description?: string; summary?: string };
  }>;
  [key: string]: unknown;
}

export class WebhookService {
  constructor(private readonly container: Container) {}

  public async processDeploy(
    payload: GenericDeployPayload,
  ): Promise<{ success: boolean; message: string }> {
    const webhookRepo = this.container.webhookRepository;
    const config = await webhookRepo.findFirstWithChannels();

    if (!config || !config.deployChannelId) {
      logger.warn('Deploy webhook received, but no deploy channel is configured in any guild');
      return { success: false, message: 'No deploy announcement channel configured in database' };
    }

    const repoName =
      payload.repository?.full_name ||
      payload.repository?.name ||
      payload.project?.name ||
      payload.repo ||
      'Repositório';

    const branch = payload.ref?.replace('refs/heads/', '') || payload.branch || 'main';

    const commitMsg =
      payload.head_commit?.message || payload.commit || 'Deploy automático executado via CI/CD';

    const author =
      payload.head_commit?.author?.name ||
      payload.sender?.login ||
      payload.author ||
      'CI/CD Pipeline';

    const status = (payload.status || 'success').toLowerCase();
    const envName = payload.environment || 'Produção';

    let color: number = BOT_COLORS.SUCCESS;
    let statusText = '✅ Deploy Concluído com Sucesso';

    if (status.includes('fail') || status.includes('error')) {
      color = BOT_COLORS.DANGER;
      statusText = '❌ Falha na Execução do Deploy';
    } else if (status.includes('start') || status.includes('progress')) {
      color = BOT_COLORS.INFO;
      statusText = '🔄 Deploy em Andamento';
    }

    const embed = BotEmbed.custom(
      statusText,
      `📦 **Projeto:** \`${repoName}\`\n🌿 **Branch:** \`${branch}\`\n🎯 **Ambiente:** \`${envName}\`\n👤 **Autor:** ${author}\n📝 **Commit:** ${commitMsg}`,
      color,
    );

    if (payload.head_commit?.url || payload.url) {
      embed.setURL((payload.head_commit?.url || payload.url) as string);
    }

    await this.container.notificationService.sendToChannel({
      guildId: config.guildId,
      module: 'webhooks',
      eventType: 'deploy_notification',
      channelId: config.deployChannelId,
      embeds: [embed],
    });

    return { success: true, message: 'Deploy notification dispatched' };
  }

  public async processAlert(
    payload: GenericAlertPayload,
  ): Promise<{ success: boolean; message: string }> {
    const webhookRepo = this.container.webhookRepository;
    const config = await webhookRepo.findFirstWithChannels();

    if (!config || !config.alertsChannelId) {
      logger.warn('Alert webhook received, but no alerts channel is configured in any guild');
      return { success: false, message: 'No alerts channel configured in database' };
    }

    // Handle Uptime Kuma format
    if (payload.heartbeat) {
      const isUp = payload.heartbeat.status === 1;
      const serviceName = payload.heartbeat.name || 'Serviço Monitorado';
      const msg = payload.heartbeat.msg || (isUp ? 'Serviço operacional' : 'Serviço fora do ar!');

      const embed = BotEmbed.custom(
        isUp ? '🟢 Uptime Kuma: Serviço Restaurado' : '🔴 Uptime Kuma: Serviço Fora do Ar',
        `🖥️ **Serviço:** \`${serviceName}\`\n📊 **Status:** ${isUp ? 'ONLINE' : 'OFFLINE'}\n💬 **Detalhes:** ${msg}`,
        isUp ? BOT_COLORS.SUCCESS : BOT_COLORS.DANGER,
      );

      await this.container.notificationService.sendToChannel({
        guildId: config.guildId,
        module: 'webhooks',
        eventType: 'alert_notification',
        channelId: config.alertsChannelId,
        embeds: [embed],
      });

      return { success: true, message: 'Uptime alert dispatched' };
    }

    // Handle Prometheus Alertmanager format
    if (payload.alerts && payload.alerts.length > 0) {
      for (const alert of payload.alerts) {
        const alertName = alert.labels?.alertname || 'Alerta Prometheus';
        const rawSeverity = (alert.labels?.severity || 'WARN').toUpperCase();
        const desc = alert.annotations?.description || alert.annotations?.summary || 'Sem detalhes';
        const isResolved = alert.status === 'resolved';

        let color: number = BOT_COLORS.WARNING;
        if (isResolved) color = BOT_COLORS.SUCCESS;
        else if (rawSeverity === 'CRITICAL') color = BOT_COLORS.DANGER;
        else if (rawSeverity === 'INFO') color = BOT_COLORS.INFO;

        const embed = BotEmbed.custom(
          `${isResolved ? '✅ RESOLVIDO:' : '🚨 ALERTA:'} ${alertName} [${rawSeverity}]`,
          `🖥️ **Instância:** \`${alert.labels?.instance || 'N/A'}\`\n📊 **Status:** ${isResolved ? 'Resolvido' : 'Disparado'}\n📝 **Descrição:** ${desc}`,
          color,
        );

        await this.container.notificationService.sendToChannel({
          guildId: config.guildId,
          module: 'webhooks',
          eventType: 'alert_notification',
          channelId: config.alertsChannelId,
          embeds: [embed],
        });
      }
      return { success: true, message: 'Prometheus alerts dispatched' };
    }

    // Generic alert payload
    const title = payload.title || payload.name || payload.service || 'Alerta de Infraestrutura';
    const rawSev = (payload.severity || 'WARN').toUpperCase();
    const details = payload.description || payload.message || 'Sem detalhes fornecidos.';

    let color: number = BOT_COLORS.WARNING;
    if (rawSev === 'CRITICAL') color = BOT_COLORS.DANGER;
    else if (rawSev === 'INFO') color = BOT_COLORS.INFO;

    const embed = BotEmbed.custom(`🚨 [${rawSev}] ${title}`, `📝 **Mensagem:** ${details}`, color);

    await this.container.notificationService.sendToChannel({
      guildId: config.guildId,
      module: 'webhooks',
      eventType: 'alert_notification',
      channelId: config.alertsChannelId,
      embeds: [embed],
    });

    return { success: true, message: 'Generic alert dispatched' };
  }
}
