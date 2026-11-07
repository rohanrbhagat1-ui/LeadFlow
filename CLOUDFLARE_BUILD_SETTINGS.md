# Fix the Cloudflare deployment settings

The earlier failure happened because Cloudflare ran `npx wrangler deploy` with no build output. This project is a full-stack Next.js app and must be built with the OpenNext Cloudflare adapter.

## 1. Repository layout

Upload the **contents** of this folder to the ROOT of the GitHub repository. `package.json`, `wrangler.jsonc`, `open-next.config.ts`, and `src/` must all be at the repository root. Do not place them inside an extra nested folder.

## 2. Cloudflare Workers Builds settings

Open Workers & Pages → leadflow → Settings → Build. Set:

- Git branch: `main`
- Root directory: `/`
- Build command: `npx @opennextjs/cloudflare build`
- Deploy command: `npx @opennextjs/cloudflare deploy`

Save the settings. The two OpenNext commands are the official Workers Builds configuration for this adapter.

## 3. Commit code first, then retry

Commit these files to GitHub. Cloudflare will start a new build from the new commit. If it does not start automatically, use Retry build only AFTER the settings above are saved and the new files are visible in the GitHub repository.

## 4. If another error appears

Do not guess at settings. Open the latest failed build, click Copy build log, and share the log text or a screenshot. Do not share environment variable values, passwords, OAuth secrets, or database keys.

## 5. Provider configuration

Once the app builds, set Supabase and app environment values in the Worker’s Variables and Secrets settings. Do not commit secrets to GitHub. The first deployment may build before Supabase is connected, but account creation and lead persistence will not work until the required Supabase values and SQL migration are configured.
