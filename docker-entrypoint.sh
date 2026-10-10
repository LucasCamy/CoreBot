#!/bin/sh
set -e

echo "🚀 [CoreBot] Initializing container runtime..."

# Wait and apply Prisma migrations if DATABASE_URL is defined
if [ -n "$DATABASE_URL" ]; then
  echo "📦 [CoreBot] Applying pending database migrations via Prisma..."
  npx prisma migrate deploy || {
    echo "⚠️ [CoreBot] Warning: Prisma migrate deploy failed or database is not reachable yet. Retrying in 3 seconds..."
    sleep 3
    npx prisma migrate deploy
  }
  echo "✅ [CoreBot] Database migrations applied successfully."
fi

echo "🤖 [CoreBot] Starting application process..."
exec "$@"
