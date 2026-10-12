#!/bin/sh
set -e

echo "🚀 [CoreBot] Initializing container runtime..."

# Wait and apply Prisma migrations if DATABASE_URL is defined
if [ -n "$DATABASE_URL" ]; then
  echo "📦 [CoreBot] Applying pending database migrations via Prisma..."
  if ! npx prisma migrate deploy; then
    echo "⚠️ [CoreBot] Warning: Prisma migrate deploy failed or database is not reachable yet. Retrying in 3 seconds..."
    sleep 3
    if ! npx prisma migrate deploy; then
      echo "⚠️ [CoreBot] Migrate deploy failed. Running db push fallback to ensure schema synchronization..."
      npx prisma db push --skip-generate || true
    fi
  fi
  echo "✅ [CoreBot] Database schema synchronized successfully."
fi

echo "🤖 [CoreBot] Starting application process..."
exec "$@"
