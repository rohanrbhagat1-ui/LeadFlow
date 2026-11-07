export const BUSINESS_TYPES: readonly string[];
export const LEAD_STATUSES: readonly string[];
export function normalizeBusinessType(value: unknown): string;
export function slugPart(value: unknown): string;
export function validateWebhookUrl(value: unknown): { ok: true; url: string } | { ok: false; reason: string };
export function hashClientIp(ip: string, secret: string): string;
export function makeGmailRawMessage(input: { to: string; subject: string; text: string }): string;
