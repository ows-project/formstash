# Formstash MVP

Formstash is a single-tenant, self-hosted form collector for Cloudflare Workers. It uses Hono for the Worker API, React for the dashboard, and D1 for durable data.

## Product decisions

- A deployment belongs to one owner; there is no public registration.
- First run creates the owner and first form in one guided flow.
- Forms are headless and accept JSON or native HTML form submissions.
- Submitted fields are flexible by default. Strict validation can be enabled per form.
- Submission IP address, country, and user agent are not stored.
- The dashboard uses an inbox and detail pane rather than an analytics homepage.
- Email delivery uses SMTP through Cloudflare Queues. It follows the core collection flow so failed email never loses a submission.
- SMTP passwords and Turnstile secrets are encrypted with the deployment's `APP_SECRET` before storage in D1.

## Current scope

- **Core:** setup, owner authentication, form management, public ingestion, inbox, detail view, spam workflow, and CSV export.
- **Delivery:** SMTP settings, test messages, Queue retries, activity history, and password reset email.
- **Protection:** origin allowlists, idempotency, honeypots, strict schemas, Turnstile, privacy-preserving rate limits, and payload limits.
- **Data lifecycle:** configurable submission retention plus automatic cleanup of expired sessions, reset tokens, rate-limit buckets, and old delivery history.

Cloudflare resources are provisioned with Wrangler. D1 remains the source of truth; operators should use Cloudflare's D1 backup and recovery tooling according to their own retention requirements.

## Submission contract

- `POST /f/:slug`
- Content types: `application/json`, `application/x-www-form-urlencoded`, and text-only `multipart/form-data`.
- Maximum encoded body size: 64 KiB; maximum 50 fields.
- Optional idempotency through the `Idempotency-Key` header or `_idempotency_key` field.
- `_source` records the page URL supplied by the integrator; `_gotcha` is the honeypot; `_turnstile` or `cf-turnstile-response` carries a Turnstile token.
- Configured browser origins are enforced when an `Origin` header is present. Requests without an origin remain available for server-to-server integrations.
- JSON clients receive `201`; native forms may receive `303` to a server-configured success URL.
