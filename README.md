# Formstash

A single-tenant, self-hosted form collector built for Cloudflare Workers. Formstash provides public headless form endpoints and a React inbox for reviewing submissions.

## Stack

- Cloudflare Workers and Hono
- Cloudflare D1
- React and Vite
- TypeScript

## Local development

```bash
pnpm install
pnpm db:migrate:local
pnpm build
pnpm dev
```

Open the local Wrangler URL and complete the two-step setup to create the owner account and first form.

## Deploy

Create a D1 database and copy its ID into `wrangler.jsonc`:

```bash
pnpm wrangler d1 create formstash
pnpm db:migrate:remote
pnpm deploy
```

The deployment serves the React dashboard and Hono API from the same Worker. Do not commit `.dev.vars` or other deployment secrets.

## Submit a form

```bash
curl https://your-worker.example/f/waiting-list \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: signup-123' \
  --data '{"email":"ada@example.com","name":"Ada","_source":"https://example.com/waitlist"}'
```

Native HTML forms using URL-encoded or multipart text fields are also accepted. File uploads are not supported. See [`docs/PLAN.md`](docs/PLAN.md) for the MVP contract and upcoming milestones.
