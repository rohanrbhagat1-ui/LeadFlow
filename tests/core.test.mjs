import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_TYPES, LEAD_STATUSES, normalizeBusinessType, slugPart, validateWebhookUrl, hashClientIp, makeGmailRawMessage } from '../src/lib/core.mjs';

test('business presets and pipeline stages are present', () => {
  assert.equal(BUSINESS_TYPES.length, 10);
  assert.ok(LEAD_STATUSES.includes('follow_up_due'));
  assert.equal(normalizeBusinessType('Home repair'), 'home_repair');
  assert.equal(normalizeBusinessType('something else'), 'other');
});

test('workspace slug is normalized and bounded', () => {
  assert.equal(slugPart('Oak & Stone Landscaping'), 'oak-stone-landscaping');
  assert.ok(slugPart('x'.repeat(100)).length <= 48);
});

test('webhook URL allowlist only accepts HTTPS Make and Zapier hooks', () => {
  assert.equal(validateWebhookUrl('https://hooks.zapier.com/hooks/catch/abc').ok, true);
  assert.equal(validateWebhookUrl('https://hook.us1.make.com/abc').ok, true);
  assert.equal(validateWebhookUrl('http://hooks.zapier.com/hooks/catch/abc').ok, false);
  assert.equal(validateWebhookUrl('https://example.com/hook').ok, false);
  assert.equal(validateWebhookUrl('https://user:pass@hooks.zapier.com/hook').ok, false);
});

test('IP identifiers are stable HMAC hashes, not raw IP addresses', () => {
  const one = hashClientIp('203.0.113.4', 'a sufficiently long test secret value');
  const two = hashClientIp('203.0.113.4', 'a sufficiently long test secret value');
  assert.equal(one, two);
  assert.equal(one.length, 64);
  assert.notEqual(one, '203.0.113.4');
});

test('Gmail MIME builder strips header newlines and returns base64url data', () => {
  const raw = makeGmailRawMessage({ to: 'person@example.com', subject: 'Hello\r\nBcc: bad@example.com', text: 'Hi there' });
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  assert.match(decoded, /Subject: Hello Bcc: bad@example\.com/);
  assert.doesNotMatch(decoded, /\r\nBcc:/);
});

test('Gmail MIME builder rejects invalid or oversized payloads', () => {
  assert.throws(() => makeGmailRawMessage({ to:'not-an-email', subject:'Hi', text:'Hello' }));
  assert.throws(() => makeGmailRawMessage({ to:'person@example.com', subject:'', text:'Hello' }));
  assert.throws(() => makeGmailRawMessage({ to:'person@example.com', subject:'Hi', text:'x'.repeat(12001) }));
});
