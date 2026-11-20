# Contributing to OutreachAI

Thanks for your interest in contributing! This guide covers how to get set up and what we expect in a pull request.

## Getting started

1. Fork the repo and clone your fork.
2. Follow **Local Development Setup** in the [README](README.md) — you need Node.js 20+ and a Postgres database (a free [Neon](https://neon.tech) project works, or use `docker-compose.yml`).
3. Copy `webapp/.env.example` to `webapp/.env.local` and fill in your own values. **Never commit `.env*` files or real credentials.**
4. Create a branch: `git checkout -b feat/short-description`.

## Development workflow

```bash
cd webapp
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests (Vitest)
npm run test:e2e     # Playwright critical-path tests
npm run lint
```

### Database changes

- Edit `webapp/prisma/schema.prisma`, then run `npm run db:migrate` to generate a migration.
- Commit the migration file in `webapp/prisma/migrations/` together with the schema change.
- Never use `prisma db push` against shared or production databases.

## What makes a good pull request

A feature is only done when all three layers exist and work together:

| Layer | Requirement |
|-------|-------------|
| **DB**  | Schema change + migration file |
| **API** | Route under `webapp/app/api/`, auth-gated, handles errors |
| **UI**  | Something a user can actually see and click |

Before opening a PR, please:

- [ ] Run `npm test` and `npm run lint` — both pass.
- [ ] Test the change in a browser (happy path **and** error states).
- [ ] Add/update tests for new behaviour where practical.
- [ ] If you add a user-configurable setting, add its UI to `webapp/app/settings/page.tsx`.
- [ ] Use the shared components in `webapp/components/ui/` and the `cn()` helper for class names.
- [ ] Keep PRs focused — one feature or fix per PR.

See [`CLAUDE.md`](CLAUDE.md) for more detailed conventions (styling, badges, migrations).

## Commit messages

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

## Reporting bugs and requesting features

Use the GitHub issue templates. For **security vulnerabilities**, do not open an issue — see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
