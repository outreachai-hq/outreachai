#!/bin/bash
set -e

echo "🚀 OutreachAI — Local Setup"
echo "================================"

# 1. Start PostgreSQL via Docker
echo ""
echo "▶ Starting PostgreSQL..."
docker compose up db -d
echo "⏳ Waiting for Postgres to be ready..."
sleep 5

# 2. Install dependencies
echo ""
echo "▶ Installing dependencies..."
npm install

# 3. Generate Prisma client
echo ""
echo "▶ Generating Prisma client..."
npx prisma generate

# 4. Run migrations (creates tables)
echo ""
echo "▶ Running database migrations..."
npx prisma migrate dev --name init

# 5. Seed database
echo ""
echo "▶ Seeding database with demo data..."
npm run db:seed

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start the app:  npm run dev"
echo "DB Studio:      npm run db:studio"
echo ""
echo "Demo login:"
echo "  Email:    akhilesh@demo.com"
echo "  Password: password123"
echo ""
echo "App running at: http://localhost:3000"
