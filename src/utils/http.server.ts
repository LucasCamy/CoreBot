import Fastify, { FastifyInstance } from 'fastify';
import fastifyBasicAuth from '@fastify/basic-auth';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { Container } from '../core/container.js';
import { prometheusRegistry, updateSystemMetrics } from './metrics.js';
import { QueueManager } from '../jobs/queue.js';
import { WebhookService } from '../modules/webhooks/services/webhook.service.js';
import { RedisManager } from '../jobs/redis.js';

let app: FastifyInstance | null = null;

export async function startHttpServer(container: Container): Promise<FastifyInstance> {
  app = Fastify({
    logger: false, // We use Pino directly for consistency
    trustProxy: true,
  });

  // 1. Basic Auth for Bull-Board Admin Dashboard
  await app.register(fastifyBasicAuth, {
    validate: (username, password, _req, _reply, done) => {
      if (username === env.ADMIN_DASHBOARD_USER && password === env.ADMIN_DASHBOARD_PASS) {
        done();
      } else {
        done(new Error('Invalid username or password'));
      }
    },
    authenticate: { realm: 'CoreBot Admin Queue Dashboard' },
  });

  // Protect /admin/queues route with basic auth
  app.addHook('onRequest', (request, reply, next) => {
    if (request.url.startsWith('/admin/queues')) {
      app?.basicAuth(request, reply, (err) => {
        if (err) {
          reply.header('WWW-Authenticate', 'Basic realm="CoreBot Admin Queue Dashboard"');
          reply.status(401).send({ error: 'Unauthorized' });
        } else {
          next();
        }
      });
    } else {
      next();
    }
  });

  // 2. Setup Bull-Board Fastify Adapter
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath('/admin/queues');

  // Load all instantiated BullMQ queues into the dashboard
  const registeredQueues = QueueManager.getAllQueues().map((q) => new BullMQAdapter(q));
  createBullBoard({
    queues: registeredQueues,
    serverAdapter,
  });

  await app.register(serverAdapter.registerPlugin(), {
    prefix: '/admin/queues',
  });

  // 3. Health & Liveness Endpoints
  app.get('/health', async (_req, reply) => {
    let dbOk = false;
    try {
      await container.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const redisOk = await RedisManager.ping();
    const isHealthy = dbOk && redisOk;

    reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbOk ? 'up' : 'down',
        redis: redisOk ? 'up' : 'down',
      },
    });
  });

  app.get('/live', async (_req, reply) => {
    reply.status(200).send({ status: 'alive' });
  });

  // 4. Prometheus Metrics Endpoint (/metrics)
  app.get('/metrics', async (_req, reply) => {
    await updateSystemMetrics(container.client);
    reply.header('Content-Type', prometheusRegistry.contentType);
    const metrics = await prometheusRegistry.metrics();
    reply.send(metrics);
  });

  // 5. Internal Webhooks Endpoints
  const webhookService = new WebhookService(container);

  // Helper auth check for webhooks
  const verifyWebhookToken = (
    req: { headers: Record<string, string | string[] | undefined> },
    reply: { status: (code: number) => { send: (body: unknown) => void } },
  ) => {
    const token = req.headers['x-webhook-token'];
    if (!token || token !== env.WEBHOOK_SECRET) {
      reply.status(401).send({ error: 'Unauthorized: invalid or missing X-Webhook-Token header' });
      return false;
    }
    return true;
  };

  app.post('/api/webhooks/deploy', async (request, reply) => {
    if (!verifyWebhookToken(request, reply)) return;
    try {
      const payload = (request.body || {}) as Record<string, unknown>;
      const result = await webhookService.processDeploy(payload);
      reply.status(result.success ? 200 : 400).send(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, 'Error handling deploy webhook');
      reply.status(500).send({ error: 'Internal Server Error', message: msg });
    }
  });

  app.post('/api/webhooks/alerts', async (request, reply) => {
    if (!verifyWebhookToken(request, reply)) return;
    try {
      const payload = (request.body || {}) as Record<string, unknown>;
      const result = await webhookService.processAlert(payload);
      reply.status(result.success ? 200 : 400).send(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, 'Error handling alert webhook');
      reply.status(500).send({ error: 'Internal Server Error', message: msg });
    }
  });

  // 6. Static Web Hosting (Landing Page, Terms of Service, Privacy Policy)
  const publicDir = fs.existsSync(path.resolve(process.cwd(), 'public'))
    ? path.resolve(process.cwd(), 'public')
    : path.resolve(process.cwd(), 'docs');

  if (fs.existsSync(publicDir)) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: '/',
    });

    app.get('/terms', async (_req, reply) => {
      return reply.sendFile('terms.html');
    });

    app.get('/privacy', async (_req, reply) => {
      return reply.sendFile('privacy.html');
    });

    logger.info(`Static landing & legal pages mounted from ${publicDir}`);
  }

  // Start listening
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`Fastify HTTP server listening on port ${env.PORT}`);
  logger.info(`Bull-Board Queue Dashboard ready at http://localhost:${env.PORT}/admin/queues`);
  logger.info(`Prometheus Metrics ready at http://localhost:${env.PORT}/metrics`);

  return app;
}

export async function stopHttpServer(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
    logger.info('Fastify HTTP server closed cleanly');
  }
}
