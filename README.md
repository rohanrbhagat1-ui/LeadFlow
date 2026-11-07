# LeadFlow Cloud v0.5.3 — Cloudflare deployment fix

**Important:** This version includes the OpenNext Cloudflare adapter and required Wrangler configuration. If you are correcting the previous failed Cloudflare build, follow `CLOUDFLARE_BUILD_SETTINGS.md` exactly.

# LeadFlow Cloud v0.5.1.1

LeadFlow is moving from a browser-only mockup to a real multi-tenant web app for small businesses. The same core workflow supports landscaping, cleaning, tutoring, repair services, pet care, professional services, and other businesses that handle inquiries and follow-ups.

## What this build actually implements

- Next.js App Router web application.
- Supabase email/password authentication and cookie-based sessions.
- Workspace creation at sign-up.
- PostgreSQL schema with Row Level Security (RLS) for workspace isolation.
- Cloud-backed lead creation and pipeline-stage updates.
- A public inquiry form at `/request/[workspace-slug]`.
- Database-backed per-IP rate limiting with hashed IP identifiers and a honeypot field.
- Google OAuth connection for Gmail sending and Google Calendar event creation.
- AES-256-GCM encryption for stored Google OAuth credentials.
- Make and Zapier HTTPS webhook connections for new-lead events, with signed payload headers.
- Optional Resend email notifications to a workspace's owner email.
- Integration event logging.

## What still needs provider setup

This source code does not create provider accounts or authorize on your behalf. You must configure the Supabase project, Google OAuth client, and any optional Resend / Make / Zapier accounts. OAuth credentials and service keys belong in `.env.local` or a hosting provider's server-side environment settings—not in chat, source code, or browser JavaScript.

## Requirements

- Node.js 20.9 or newer (Node 22 recommended).
- npm.
- A Supabase project.
- A Google Cloud project only if you want Gmail / Calendar integration.

## 1. Install and configure locally

On a Mac, the included `run-mac.command` checks Node, copies `.env.example` to `.env.local` if needed, installs dependencies, and starts the local dev server. First create your Supabase project and apply the SQL migration below, then fill in `.env.local`. You can run it from Terminal with:

```bash
chmod +x run-mac.command
./run-mac.command
```

Or install manually in Terminal:

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in the Supabase values. Use the new server-only secret key for `SUPABASE_SECRET_KEY`. Never prefix it with `NEXT_PUBLIC_`. Supabase is deprecating legacy `service_role` keys by the end of 2026; the code accepts `SUPABASE_SERVICE_ROLE_KEY` only as a compatibility fallback.

Generate two independent random secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Paste the first into `INTEGRATION_ENCRYPTION_KEY` (64 hexadecimal characters) and the second into `INTAKE_RATE_LIMIT_SECRET`.

## 2. Create the database

1. Open your Supabase project dashboard.
2. Open **SQL Editor**.
3. Run the complete file `supabase/migrations/0001_initial.sql`.
4. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect allow list.
5. Keep email confirmation enabled for real accounts. The workspace is provisioned by a database trigger when the Auth user is created.

The migration creates workspace, member, lead, activity, integration, and rate-limit tables. The core business tables have RLS policies. Integration secrets have no end-user table policies and are accessed only by server code using the server-only service-role key.

## 3. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`, create a test workspace, and add fictional leads. The dashboard uses Supabase, so it will not run as a data-backed app until the environment variables and SQL migration are complete.

Run checks:

```bash
npm test
npm run typecheck
npm run build
```

## 4. Connect Google Gmail and Calendar

Google OAuth is a real server-side authorization flow. LeadFlow asks the workspace owner to authorize these scopes:

- `openid` and `email` to identify the connected Google account.
- `gmail.send` to send an explicitly initiated email from the connected Gmail account.
- `calendar.events` to create an event in the connected user's primary calendar.

Setup:

1. Create or choose a project in Google Cloud Console.
2. Enable the Gmail API and Google Calendar API.
3. Configure the OAuth consent screen. For initial development, use Testing mode and add the adult-managed test Google account as a test user.
4. Create an OAuth client ID of type **Web application**.
5. Add this authorized redirect URI exactly: `http://localhost:3000/api/integrations/google/callback`.
6. Put the client ID and client secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`.
7. Set `GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback`.
8. Restart the development server, sign in, and click **Connect** under Google Workspace.

Google may require app verification before external users can authorize sensitive Gmail / Calendar scopes outside your test-user list. Do not claim the integration is publicly approved until Google has approved it.

## 5. Connect Make or Zapier

1. Create a webhook trigger in the Make or Zapier account managed by the business.
2. Copy the generated HTTPS webhook URL.
3. In LeadFlow, paste it into the Make / Zapier connection field.
4. New lead records are sent as a `lead.created` JSON event. The request includes an `x-leadflow-signature` HMAC header and event name header.

The current version intentionally accepts Make/Zapier hook domains only. Do not paste a webhook URL that belongs to somebody else. The payload includes the inquiry details, so only connect a workspace that the business controls.

## 6. Optional owner email alerts with Resend

1. Create a Resend account managed by the business/adult account owner.
2. Verify a sending domain.
3. Add the API key to `RESEND_API_KEY` and the approved sender to `RESEND_FROM_EMAIL`.
4. Restart the server.

When a new public or manually recorded lead is created, LeadFlow sends a notification to the workspace's owner email. This is separate from sending a customer email through Gmail.

## 7. Public inquiry form

After sign-up, the workspace has a slug. The public form URL is:

`http://localhost:3000/request/YOUR-WORKSPACE-SLUG`

The database function that creates public leads is executable only by the server's service role; it is not exposed to anonymous browser clients. The API hashes the source IP for database-backed rate limiting and rejects a filled honeypot field. Before putting this form on a public website, configure Cloudflare Turnstile using both `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and add the widget to the form, or use an equivalent managed bot-protection layer. The form renders the Turnstile widget when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set and the API verifies its response when `TURNSTILE_SECRET_KEY` is configured. Configure both keys together.

## Security notes

- Never commit `.env.local` or share a service-role key, Google client secret, encryption key, or webhook token in a chat.
- The Supabase secret key (or legacy service-role key) bypasses RLS. It is used only in server-only modules for encrypted integration storage and the public-intake RPC.
- Google access / refresh tokens are encrypted at rest with AES-256-GCM. Losing `INTEGRATION_ENCRYPTION_KEY` makes those stored credentials unreadable; keep a secure backup of the key.
- Email sending is restricted to a lead's recorded email address and requires the lead's contact-permission flag.
- Customer-facing messages and calendar events require a deliberate user action; there is no background mass-messaging workflow.
- This is an early implementation, not a certified production system. Before onboarding paying customers, complete a security review, restore test, monitoring, privacy/retention policy, verified domain setup, abuse controls, and penetration testing.
- A parent or guardian should manage provider accounts, project ownership, billing, contracts, and business registration where required. Do not bypass provider age or account requirements.

## Architecture

```text
Customer website
      │
      ▼
/request/[slug] ──► /api/intake/[slug]
                           │
                           ▼
                   Supabase RPC (server role)
                           │
                           ▼
                  Postgres + RLS workspace
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
            Resend      Make/Zapier   LeadFlow UI
          notification   webhook      (signed-in)
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                         Gmail API            Calendar API
                       (Google OAuth)         (Google OAuth)
```

## Current scope exclusions

No Stripe billing, automatic subscriptions, team invitation emails, bulk customer marketing, arbitrary third-party OAuth connections, or field-service platform sync is implemented yet. Billing is deliberately excluded from this first cloud build. Add one provider integration at a time after the first customer workflow is proven.
