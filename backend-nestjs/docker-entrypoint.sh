#!/bin/sh
set -e

# Compose development supplies its own migration/watch command.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

if [ -z "$JWT_ACCESS_SECRET" ] || [ -z "$JWT_REFRESH_SECRET" ]; then
  echo "ERROR: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set"
  exit 1
fi

if [ "$JWT_ACCESS_SECRET" = "default-secret" ] || [ "$JWT_REFRESH_SECRET" = "default-secret" ]; then
  echo "ERROR: JWT secrets must not be 'default-secret'"
  exit 1
fi

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting SyncQuote API on port ${PORT:-3001}..."
exec node dist/main
