import { createHmac } from 'node:crypto';

export const BUSINESS_TYPES = [
  'landscaping', 'cleaning', 'home_repair', 'tutoring', 'auto_detailing',
  'pet_care', 'professional_services', 'photography', 'retail', 'other'
];

export const LEAD_STATUSES = [
  'new', 'contacted', 'appointment_booked', 'quote_sent', 'follow_up_due', 'won', 'lost'
];

export function normalizeBusinessType(value) {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[ -]+/g, '_');
  return BUSINESS_TYPES.includes(normalized) ? normalized : 'other';
}

export function slugPart(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'business';
}

export function validateWebhookUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { return { ok: false, reason: 'Enter a valid webhook URL.' }; }
  if (url.protocol !== 'https:') return { ok: false, reason: 'Webhook URLs must use HTTPS.' };
  const host = url.hostname.toLowerCase();
  const allowed = host === 'hooks.zapier.com' || host === 'hook.make.com' || host.endsWith('.make.com');
  if (!allowed) return { ok: false, reason: 'For this first release, use a Zapier or Make webhook URL.' };
  if (url.username || url.password) return { ok: false, reason: 'Do not put credentials in the webhook URL.' };
  if (url.toString().length > 2000) return { ok: false, reason: 'Webhook URL is too long.' };
  return { ok: true, url: url.toString() };
}

export function hashClientIp(ip, secret) {
  if (!secret || String(secret).length < 24) throw new Error('INTAKE_RATE_LIMIT_SECRET must be at least 24 characters.');
  return createHmac('sha256', secret).update(String(ip || 'unknown')).digest('hex');
}

export function makeGmailRawMessage({ to, subject, text }) {
  const cleanTo = String(to).replace(/[\r\n]+/g, '').trim();
  const cleanSubject = String(subject).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const safeText = String(text).replace(/\0/g, '').trim();
  if (!/^\S+@\S+\.\S+$/.test(cleanTo)) throw new Error('A valid recipient email is required.');
  if (!cleanSubject || cleanSubject.length > 180) throw new Error('Subject must be between 1 and 180 characters.');
  if (!safeText || safeText.length > 12000) throw new Error('Message must be between 1 and 12,000 characters.');
  const mime = [
    `To: ${cleanTo}`,
    `Subject: ${cleanSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(safeText, 'utf8').toString('base64')
  ].join('\r\n');
  return Buffer.from(mime, 'utf8').toString('base64url');
}
