# LeadFlow v0.5.1.1 integration status

| Service | Implemented behavior | Setup still required |
|---|---|---|
| Supabase Auth | Email/password sign-up, sign-in, cookie sessions | Project URL, publishable key, redirect URL setup |
| Supabase Postgres | Shared cloud leads, workspaces, membership, RLS | Apply SQL migration; add server service-role key |
| Google Gmail | Send one customer email from a connected Gmail account | Google Cloud OAuth app, Gmail API, test/approved user, consent |
| Google Calendar | Create event in connected user's primary calendar | Same Google OAuth connection; Calendar API |
| Make | Forward new lead events to a Make webhook | Create scenario webhook and paste its URL |
| Zapier | Forward new lead events to a Zapier catch hook | Create Zap webhook and paste its URL |
| Resend | Notify workspace owner when lead is received | Verified sending domain and server API key |
| Cloudflare Turnstile | Widget rendering and server-side token verification | Add both site and secret keys; verify the deployed hostname in Cloudflare |

### Data flow

`lead.created` contains the workspace ID and an allowlisted set of lead fields: lead ID, customer name, email, phone, service/request, source, status, and creation timestamp. It deliberately omits internal notes and consent flags. A workspace admin chooses the Make or Zapier endpoint. LeadFlow encrypts the endpoint and signing secret at rest, then sends an HMAC signature header. A connected automation should only accept and process events from its own business workspace.

### Not live yet

QuickBooks, Xero, Stripe, Square, Jobber, Housecall Pro, Calendly, Microsoft 365, Meta, Google Ads, and other tools are not connected in v0.5.1.1. They need separate provider-specific authorization, sync rules, error handling, and testing.
