import { parseExtractedIntent, stripCodeFences } from './intent-parser.js';

const valid = {
  orderId: 'ORD-1001',
  reason: 'damaged',
  summary: 'Customer reports the mug set arrived cracked.',
  confidence: 0.92,
  injectionSuspected: false,
};

describe('stripCodeFences', () => {
  it.each([
    ['```json\n{"a":1}\n```', '{"a":1}'],
    ['```\n{"a":1}\n```', '{"a":1}'],
    ['  ```JSON\n{"a":1}```  ', '{"a":1}'],
    ['{"a":1}', '{"a":1}'],
  ])('turns %j into %j', (input, expected) => {
    expect(stripCodeFences(input)).toBe(expected);
  });
});

describe('parseExtractedIntent', () => {
  it('accepts valid JSON', () => {
    expect(parseExtractedIntent(JSON.stringify(valid))).toEqual({
      ok: true,
      value: valid,
    });
  });

  it('accepts JSON wrapped in a code fence', () => {
    const raw = '```json\n' + JSON.stringify(valid, null, 2) + '\n```';

    expect(parseExtractedIntent(raw)).toEqual({ ok: true, value: valid });
  });

  it('accepts a null order ID', () => {
    const result = parseExtractedIntent(
      JSON.stringify({ ...valid, orderId: null }),
    );

    expect(result.ok && result.value.orderId).toBeNull();
  });

  it('normalises the case and whitespace of the order ID', () => {
    const result = parseExtractedIntent(
      JSON.stringify({ ...valid, orderId: ' ord-1001 ' }),
    );

    expect(result.ok && result.value.orderId).toBe('ORD-1001');
  });

  it.each([
    ['plain text', 'Sure! The customer wants a refund.'],
    ['truncated JSON', '{"orderId": "ORD-1001", "reason": "dam'],
    ['an empty string', ''],
  ])('rejects malformed output: %s', (_label, raw) => {
    expect(parseExtractedIntent(raw)).toEqual({
      ok: false,
      error: 'Output is not valid JSON.',
    });
  });

  it.each([
    ['a missing field', { ...valid, confidence: undefined }],
    ['an unknown reason', { ...valid, reason: 'too_expensive' }],
    ['confidence above 1', { ...valid, confidence: 1.5 }],
    ['confidence below 0', { ...valid, confidence: -0.1 }],
    ['confidence as a string', { ...valid, confidence: '0.9' }],
    ['a malformed order ID', { ...valid, orderId: '1001' }],
    ['an extra field', { ...valid, decision: 'APPROVED' }],
    ['an over-long summary', { ...valid, summary: 'x'.repeat(301) }],
    ['a JSON array', [valid]],
  ])('rejects output with %s', (_label, data) => {
    const result = parseExtractedIntent(JSON.stringify(data));

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/^Output failed validation/);
  });
});
