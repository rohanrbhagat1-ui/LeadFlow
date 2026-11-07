# LeadFlow — Cloudflare Workers + GitHub setup (v0.5.3)

This is a full-stack Next.js application. Deploy to **Cloudflare Workers using the OpenNext adapter**, not Pages static hosting and not a plain `wrangler deploy` command.

## GitHub repository layout

Place the contents of this project at repository root. `package.json`, `wrangler.jsonc`, `open-next.config.ts`, `src/`, and `supabase/` must be direct children of the repository root. Cloudflare root directory should be `/`.

## Cloudflare Workers Builds settings

In Workers & Pages → leadflow → Settings → Build, set:

- Root directory: `/`
- Build command: `npx @opennextjs/cloudflare build`
- Deploy command: `npx @opennextjs/cloudflare deploy`

These are the official OpenNext Workers Builds commands. The project includes `@opennextjs/cloudflare`, `wrangler.jsonc`, and `open-next.config.ts`.

## Environment variables

After the first successful build, configure the variables and secrets described in `.env.example` in the Cloudflare Worker settings. At minimum, Supabase URL and publishable key are needed for login; the server secret key, encryption key, intake rate limit secret, and production site URL are also required for full functionality. Add OAuth and email provider credentials only when those integrations are configured. Never commit secret values.

## Testing

Use fictional information until authentication, row-level security, secrets, backups, and public-form anti-spam settings have been reviewed.
