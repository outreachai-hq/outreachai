#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🔍 Finding your Postgres Docker container..."
PG_CONTAINER=$(docker ps --filter "ancestor=postgres" --format "{{.Names}}" | head -1)

if [ -z "$PG_CONTAINER" ]; then
  PG_CONTAINER=$(docker ps --format "{{.Names}}\t{{.Ports}}" | grep "5432" | awk '{print $1}' | head -1)
fi

if [ -z "$PG_CONTAINER" ]; then
  echo "❌ No running Postgres container found. Please start it first."
  exit 1
fi

echo "✅ Found: $PG_CONTAINER"

echo "📦 Creating database 'outreachai'..."
docker exec "$PG_CONTAINER" psql -U postgres -c "CREATE DATABASE outreachai;" 2>/dev/null || echo "  (already exists, skipping)"

echo "🔄 Running migrations..."
npx prisma migrate dev --name init

echo "🌱 Seeding data..."
npm run db:seed

echo ""
echo "✅ Done! Starting app..."
echo "   Open: http://localhost:3000"
echo "   Login: akhilesh@demo.com / password123"
echo ""
npm run dev
