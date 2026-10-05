# Formstash

A single-tenant, self-hosted form collector built for Cloudflare Workers. Formstash provides public headless form endpoints and a React inbox for reviewing submissions.

## Features

- First-run owner and form setup
- JSON, URL-encoded, and multipart text submissions
- Inbox, search, spam workflow, CSV export, and configurable form schemas
- Origin allowlists, per-form rate limits, honeypots, and optional Turnstile
- SMTP notifications and password resets delivered through Cloudflare Queues
- Encrypted SMTP and Turnstile credentials, delivery activity, and retention cleanup

## Stack

- Cloudflare Workers and Hono
- Cloudflare D1 and Queues
- React and Vite
- TypeScript

## Local development

```bash
pnpm install
pnpm db:migrate:local
pnpm build
pnpm dev
```

Create `.dev.vars` with a long random value before configuring SMTP or Turnstile locally:

```dotenv
APP_SECRET="replace-with-a-long-random-value"
```

Open the local Wrangler URL and complete the two-step setup to create the owner account and first form. Wrangler runs D1, Queues, and the scheduled handler locally.

## Deploy

Create the D1 database and Queue resources, then copy the D1 database ID into `wrangler.jsonc`:

```bash
pnpm wrangler d1 create formstash
pnpm wrangler queues create formstash-email
pnpm wrangler queues create formstash-email-dlq
openssl rand -base64 32 | pnpm wrangler secret put APP_SECRET
pnpm db:migrate:remote
pnpm deploy
```

The deployment serves the React dashboard and Hono API from the same Worker. The daily retention job runs at 03:00 UTC. Do not commit `.dev.vars` or other deployment secrets. Keep `APP_SECRET` stable: changing it makes previously stored SMTP and Turnstile credentials unreadable until they are saved again.

## Submit a form

```bash
curl https://your-worker.example/f/waiting-list \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: signup-123' \
  --data '{"email":"ada@example.com","name":"Ada","_source":"https://example.com/waitlist"}'
```

Native HTML forms using URL-encoded or multipart text fields are also accepted. File uploads are not supported. See [`docs/PLAN.md`](docs/PLAN.md) for the product contract and deployment scope.
