# Changelog

## v0.5.1

- Fixed Google OAuth callback state-cookie handling: read and compare state before expiring the cookie.
- Require a Google refresh token for a durable Gmail/Calendar connection and keep provider error details out of redirect URLs.
- Require Cloudflare Turnstile site and secret keys to be configured together.
- Restrict signup business types to the supported presets in the database trigger.
- Make the SQL policy setup rerunnable by dropping the app policies before recreating them.
- Prune old hashed public-intake rate-limit buckets.
- Prevent webhook redirects and add a URL length limit.
- Restrict third-party webhook payloads to an explicit, minimal lead-field allowlist.
- Add a Mac launcher that checks Node, installs dependencies, verifies that local config placeholders have been replaced, and opens the app after startup.
- Add regression tests for the security and configuration checks.

## v0.5.0

- Initial full-stack Next.js + Supabase starter with workspace authentication, RLS, leads, public inquiry intake, Google OAuth, Make/Zapier webhooks, and optional Resend notifications.
