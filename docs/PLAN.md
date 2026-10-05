# Formstash MVP

Formstash is a single-tenant, self-hosted form collector for Cloudflare Workers. It uses Hono for the Worker API, React for the dashboard, and D1 for durable data.

## Product decisions

- A deployment belongs to one owner; there is no public registration.
- First run creates the owner and first form in one guided flow.
- Forms are headless and accept JSON or native HTML form submissions.
- Submitted fields are flexible. The configured field list controls presentation, not ingestion.
- Submission IP address, country, and user agent are not stored.
- The dashboard uses an inbox and detail pane rather than an analytics homepage.
- Email delivery will use SMTP through Cloudflare Queues. It follows the core collection flow so failed email never loses a submission.

## Milestones

1. **Core vertical slice:** setup, authentication, forms, public submission ingestion, inbox, submission detail.
2. **Delivery:** SMTP configuration, connection test, Queue consumer, retries, and activity history.
3. **Protection:** Turnstile, rate limiting, retention controls, and spam workflow.
4. **Operations:** export, backups/documentation, deployment automation, and additional administrators if needed.

## Submission contract

- `POST /f/:slug`
- Content types: `application/json`, `application/x-www-form-urlencoded`, and text-only `multipart/form-data`.
- Maximum encoded body size: 64 KiB; maximum 50 fields.
- Optional idempotency through the `Idempotency-Key` header or `_idempotency_key` field.
- `_source` records the page URL supplied by the integrator; `_gotcha` is the honeypot.
- Configured browser origins are enforced when an `Origin` header is present. Requests without an origin remain available for server-to-server integrations.
- JSON clients receive `201`; native forms may receive `303` to a server-configured success URL.
