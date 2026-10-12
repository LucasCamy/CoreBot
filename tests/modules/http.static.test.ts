import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';

describe('HTTP Static Web Hosting', () => {
  it('serves landing page, terms, privacy, and assets correctly', async () => {
    const app = Fastify();
    const publicDir = path.resolve(process.cwd(), 'public');

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

    // 1. Root landing page
    const resRoot = await app.inject({ method: 'GET', url: '/' });
    expect(resRoot.statusCode).toBe(200);
    expect(resRoot.body).toContain('Uganda Knuckles');
    expect(resRoot.headers['content-type']).toContain('text/html');

    // 2. Terms of service
    const resTerms = await app.inject({ method: 'GET', url: '/terms' });
    expect(resTerms.statusCode).toBe(200);
    expect(resTerms.body).toContain('Termos de Serviço');

    // 3. Privacy policy
    const resPrivacy = await app.inject({ method: 'GET', url: '/privacy' });
    expect(resPrivacy.statusCode).toBe(200);
    expect(resPrivacy.body).toContain('Política de Privacidade');

    // 4. CSS file
    const resCss = await app.inject({ method: 'GET', url: '/style.css' });
    expect(resCss.statusCode).toBe(200);
    expect(resCss.headers['content-type']).toContain('text/css');

    // 5. Direct .html access
    const resTermsHtml = await app.inject({ method: 'GET', url: '/terms.html' });
    expect(resTermsHtml.statusCode).toBe(200);

    await app.close();
  });
});
