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

### Automatic deploys and previews

Workers Builds is connected to this repository:

- Pushing to `main` runs `pnpm ci:build` (typecheck, tests, build), then `pnpm ci:deploy`, which applies D1 migrations and deploys to production.
- Pushing any other branch runs `pnpm ci:preview`. It migrates the shared preview database and creates or updates a Worker Preview at `<branch>-formstash.<subdomain>.workers.dev`, posted as a comment on the branch's pull request.

Previews use the `formstash-preview` D1 database and the `formstash-email-preview` queue. That queue has no consumer, so previews never send email. Previews get `APP_SECRET` from the Preview base config (`pnpm wrangler preview base-config secret put APP_SECRET`). The Workers Builds API token needs **D1 Edit** and **Queues Edit** in addition to its default permissions.

The deployment serves the React dashboard and Hono API from the same Worker. The daily retention job runs at 03:00 UTC. Do not commit `.dev.vars` or other deployment secrets. Keep `APP_SECRET` stable: changing it makes previously stored SMTP and Turnstile credentials unreadable until they are saved again.

## Submit a form

```bash
curl https://your-worker.example/f/waiting-list \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: signup-123' \
  --data '{"email":"ada@example.com","name":"Ada","_source":"https://example.com/waitlist"}'
```

Native HTML forms using URL-encoded or multipart text fields are also accepted. File uploads are not supported. See [`docs/PLAN.md`](docs/PLAN.md) for the product contract and deployment scope.

## Optional submission schemas

New forms accept any field name by default, within the existing limits: a flat object of string, number, boolean, or null values, up to 50 fields, 10,000 characters per string, and a 64 KiB request. Display fields only control inbox columns and example snippets; they are not a schema.

In **Form settings → Submission schema**, add named fields, choose their types and validation rules, then turn on **Enforce schema**. Unknown fields are dropped. Missing or blank required fields, wrong types, and failed rules reject the entire submission with HTTP `422`. Only validated, transformed data is stored and included in email notifications. Optional fields may be absent; if present, they must pass validation. Required treats whitespace-only strings and null as empty, but accepts `0` and `false`. Use a boolean `equals: true` rule for consent.

Schema configuration is available as `schema` in the authenticated forms API; `strictFields` enables enforcement. For example, include these settings in the form settings PATCH:

```json
{
  "strictFields": true,
  "schema": [
    {
      "name": "email",
      "type": "string",
      "required": true,
      "rules": [{ "check": "trim" }, { "check": "email" }]
    },
    {
      "name": "age",
      "type": "number",
      "rules": [{ "check": "int" }, { "check": "min", "value": 18 }]
    },
    {
      "name": "username",
      "type": "string",
      "rules": [{ "check": "forbiddenCharacters", "value": "<>$" }]
    },
    { "name": "department", "type": "enum", "values": ["sales", "support"] }
  ]
}
```

Rules run in order using Zod on the backend. Each rule has a `check`, an optional `value`, optional `options`, and an optional custom `message`. The UI lists supported checks:

- **Strings:** min/max/exact length, nonempty, includes/startsWith/endsWith, lowercase/uppercase, and trim/case/Unicode normalization transformations.
- **String formats:** email, URL/HTTP URL, UUID/GUID and ID formats, IP/CIDR/MAC, base64/base64url, E.164 phone, JWT, credit card, IBAN, hostname, hex/hash, currency code, and ISO date/time/datetime/duration.
- **Numbers:** inclusive/exclusive bounds, integer/safe integer, positive/negative/nonnegative/nonpositive, multipleOf/step, and float32/float64/int32/uint32 checks.
- **Boolean:** `equals` with `true` or `false`. **Enum:** a list of allowed strings. **Scalar:** any existing scalar type, useful for an allowlist without type restrictions and for migrating old strict forms.
- **Custom patterns:** `regex` uses safe RE2 syntax with optional `options.flags` (`i`, `m`, `s`). Backreferences and lookarounds are not supported. `forbiddenCharacters` needs no regex.

Format options include datetime `offset`/`local`/`precision`, time `precision`, UUID `version`, JWT `alg`, MAC `delimiter`, and URL `normalize`. Hash takes its algorithm as `value` and optional `options.enc`. Invalid rule names, options, and patterns are rejected when saving settings, even if enforcement is off. Up to 50 schema fields and 20 rules per field are supported.

Native HTML numeric strings are converted only when they represent decimal numbers; empty strings never become zero. Boolean fields accept JSON booleans and HTML `true`/`on`/`false`. Optional fields can explicitly allow null with `nullable: true`.

Validation errors have the following shape:

```json
{
  "error": "Submission failed schema validation",
  "errors": { "email": ["This field is required"] }
}
```

This exposes Zod's built-in validations for the supported flat JSON field types, not executable Zod code. Function-based custom refinements/transforms, non-JSON types, nested objects/arrays, and file validators are not supported. Reserved metadata fields (`_source`, `_gotcha`, `_idempotency_key`, `_turnstile`, `cf-turnstile-response`) are processed separately before schema validation. Existing strict forms migrate to optional scalar schemas; extra fields now get dropped instead of rejected.
