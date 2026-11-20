.PHONY: up down build logs shell db-migrate db-reset test test-critical test-critical-prod seed-test-user

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build --no-cache

logs:
	docker compose logs -f app

shell:
	docker compose exec app sh

db-migrate:
	docker compose exec app npx prisma migrate deploy

db-reset:
	docker compose down -v
	docker compose up -d

# ── Tests ─────────────────────────────────────────────────────────────────────

test:
	cd webapp && npm test

test-critical:
	cd webapp && npm run test:critical

test-critical-prod:
	cd webapp && npm run test:critical:prod

seed-test-user:
	cd webapp && DATABASE_URL=$$(grep DATABASE_URL .env.local | cut -d= -f2-) \
	npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-user.ts
