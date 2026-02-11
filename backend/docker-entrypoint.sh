#!/usr/bin/env sh
set -e

echo "Waiting for db..."
until nc -z db 5432; do
  sleep 2
done

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting backend..."
node dist/index.js

