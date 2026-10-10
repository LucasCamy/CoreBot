# 🚀 Guia de Deploy em Produção — CoreBot

Este documento descreve as etapas para implantar o **CoreBot** em ambiente de produção utilizando Docker e Docker Compose, garantindo segurança, persistência e alta disponibilidade.

---

## 1. Pré-requisitos do Servidor

- Sistema Operacional: Linux (Ubuntu 22.04 LTS / Debian 12 recomendados) ou Windows Server.
- Docker Engine >= 24.0.0
- Docker Compose v2 >= 2.20.0
- Mínimo de 1 GB de RAM e 1 vCPU
- Portas liberadas localmente: 3000 (Healthcheck interno), 5432 (Postgres - apenas interno), 6379 (Redis - apenas interno).

---

## 2. Preparação do Ambiente

Clone o repositório no servidor:

```bash
git clone <url-do-repositorio> corebot
cd corebot
```

Crie o arquivo de variáveis de ambiente de produção:

```bash
cp .env.example .env
nano .env
```

Preencha os valores reais com atenção redobrada:

```env
NODE_ENV=production
BOT_TOKEN=SEU_DISCORD_BOT_TOKEN_REAL
DISCORD_CLIENT_ID=SEU_CLIENT_ID_REAL
DISCORD_ALLOWED_GUILD_IDS=ID_DO_SEU_SERVIDOR
DATABASE_URL=postgresql://corebot:SUA_SENHA_FORTE@postgres:5432/corebot?schema=public
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=SUA_SENHA_REDIS_FORTE
LOG_LEVEL=info
TIMEZONE=America/Sao_Paulo
PORT=3000
```

---

## 3. Subindo a Stack com Docker Compose

Para produção, utilize o arquivo otimizado `docker-compose.prod.yml`:

```bash
# Construir e iniciar os containers em segundo plano
docker compose -f docker-compose.prod.yml up -d --build
```

### Aplicando Migrações do Banco de Dados

Logo após subir os containers pela primeira vez, aplique as migrações do Prisma:

```bash
docker compose -f docker-compose.prod.yml exec bot npx prisma migrate deploy
```

---

## 4. Verificação de Saúde e Logs

### Verificar status dos containers:

```bash
docker compose -f docker-compose.prod.yml ps
```

Todos os serviços (`corebot-production`, `corebot-postgres-prod`, `corebot-redis-prod`) devem apresentar status `healthy` ou `running`.

### Visualizar logs estruturados em tempo real:

```bash
docker compose -f docker-compose.prod.yml logs -f bot
```

### Testar endpoint de saúde HTTP:

```bash
curl -f http://127.0.0.1:3000/health
```

Resposta esperada (código 200):

```json
{
  "status": "healthy",
  "timestamp": "2026-10-10T19:30:00.000Z",
  "uptime": 120.45,
  "checks": {
    "database": "up",
    "redis": "up"
  }
}
```

---

## 5. Rotina de Backup do PostgreSQL

Para realizar backups diários dos dados do CoreBot:

```bash
# Gerar dump do banco
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U corebot corebot > backup_$(date +%Y%m%d_%H%M%S).sql
```

Para restaurar um backup:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres psql -U corebot corebot < backup_20261010_000000.sql
```

---

## 6. Atualização e Reduções de Downtime

Para atualizar o bot com novas versões do código:

```bash
git pull origin main
docker compose -f docker-compose.prod.yml build bot
docker compose -f docker-compose.prod.yml up -d --no-deps bot
docker compose -f docker-compose.prod.yml exec bot npx prisma migrate deploy
```
