# Before using real customer data

- [ ] Use a production Supabase project with backups enabled.
- [ ] Verify all tables have the intended RLS policies; test with two unrelated user accounts to prove tenant isolation.
- [ ] Never expose `SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY`, Google OAuth secrets, `INTEGRATION_ENCRYPTION_KEY`, Resend keys, or webhook URLs to the browser.
- [ ] Configure HTTPS and production callback URLs.
- [ ] Configure Turnstile or equivalent anti-abuse protection on public forms.
- [ ] Set data retention, privacy, and deletion procedures.
- [ ] Test access-token refresh and provider disconnection/revocation.
- [ ] Verify consent/legal basis for each customer communication channel.
- [ ] Test email deliverability and sender-domain authentication.
- [ ] Test webhook retries, duplicate events, and failed integrations.
- [ ] Run a restore test from backup.
- [ ] Complete security review and monitoring before selling access.
- [ ] Have an adult manage provider accounts, billing, contracts, and business setup where required.
