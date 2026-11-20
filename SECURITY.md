# Security Policy

## Supported versions

Only the latest release on the `main` branch receives security fixes.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, use GitHub's [private vulnerability reporting](../../security/advisories/new) for this repository, or email **outreachai.in@gmail.com** with the subject line `SECURITY`.

Please include:

- A description of the issue and its impact
- Steps to reproduce (proof-of-concept if possible)
- Affected routes, files, or versions

We aim to acknowledge reports within **3 business days** and to provide a remediation timeline within **10 business days**. We will credit reporters in the release notes unless you prefer to stay anonymous.

## Scope

In scope: the web app (`webapp/`), the browser extension (`extension/`), and deployment configuration in this repository.

Out of scope: third-party services we integrate with (LinkedIn, AWS SES, Neon, Vercel, AI providers) — please report those to the respective vendor.

## Handling secrets

If you self-host OutreachAI, keep `ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, OAuth client secrets, and database credentials out of version control. `ENCRYPTION_KEY` protects users' stored API keys — rotating it requires re-encrypting those values.
