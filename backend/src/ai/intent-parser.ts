import {
  ExtractedIntentSchema,
  type ExtractedIntent,
} from './extracted-intent.schema.js';

export type Validated<T> =
  { ok: true; value: T } | { ok: false; error: string };

/** Removes a surrounding Markdown code fence, e.g. ```json ... ```, if present. */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?\s*```$/.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Turns raw model output into a validated intent, or explains why it can't.
 * Never throws: invalid output is an expected failure that the caller turns
 * into an escalation.
 */
export function parseExtractedIntent(raw: string): Validated<ExtractedIntent> {
  let data: unknown;
  try {
    data = JSON.parse(stripCodeFences(raw));
  } catch {
    return { ok: false, error: 'Output is not valid JSON.' };
  }

  // Accept "ord-1001" and stray whitespace; the format is then checked strictly.
  if (isRecord(data) && typeof data.orderId === 'string') {
    data = { ...data, orderId: data.orderId.trim().toUpperCase() };
  }

  const result = ExtractedIntentSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return { ok: false, error: `Output failed validation: ${issues}` };
  }
  return { ok: true, value: result.data };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
