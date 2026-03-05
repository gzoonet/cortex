import type { ZodSchema } from 'zod';
import { CortexError, LLM_EXTRACTION_FAILED } from '@cortex/core';

/**
 * Strip markdown fences and extract JSON from LLM output.
 * Strategy: strip fences → find first { or [ → find matching } or ] → parse.
 */
function extractJson(raw: string): string {
  // Strip markdown fences
  let cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();

  // Find the first JSON structure
  const startIdx = findJsonStart(cleaned);
  if (startIdx === -1) {
    throw new Error('No JSON found in response');
  }

  const openChar = cleaned[startIdx]!;
  const closeChar = openChar === '{' ? '}' : ']';
  const endIdx = findMatchingClose(cleaned, startIdx, openChar, closeChar);

  if (endIdx === -1) {
    // LLM response was truncated — try to repair
    const repaired = repairTruncatedJson(cleaned.slice(startIdx));
    if (repaired) return repaired;
    throw new Error('Unterminated JSON in response');
  }

  cleaned = cleaned.slice(startIdx, endIdx + 1);
  return cleaned;
}


/**
 * Attempt to repair truncated JSON by closing open brackets/braces.
 * Finds the last complete array element or object property, trims there,
 * then closes all open structures.
 */
function repairTruncatedJson(truncated: string): string | null {
  // Find the last complete value boundary (end of a complete JSON value)
  // Look backwards for the last }, ], number, "string", true, false, null
  // that's followed by a comma or is at the right nesting level
  let lastGoodIdx = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  const openStack: string[] = [];

  for (let i = 0; i < truncated.length; i++) {
    const ch = truncated[i]!;
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{' || ch === '[') {
      openStack.push(ch);
      depth++;
    } else if (ch === '}' || ch === ']') {
      openStack.pop();
      depth--;
      if (depth >= 1) lastGoodIdx = i;
    } else if (ch === ',' && depth >= 1) {
      // A comma after a complete value — the value before this is safe
      lastGoodIdx = i - 1;
    }
  }

  if (lastGoodIdx <= 0) return null;

  // Trim to last good position (skip any trailing comma)
  let repaired = truncated.slice(0, lastGoodIdx + 1).trimEnd();
  if (repaired.endsWith(',')) repaired = repaired.slice(0, -1);

  // Count remaining open brackets/braces and close them
  const remaining: string[] = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i]!;
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') remaining.push('}');
    else if (ch === '[') remaining.push(']');
    else if (ch === '}' || ch === ']') remaining.pop();
  }

  // Close in reverse order
  repaired += remaining.reverse().join('');

  // Validate it parses
  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return null;
  }
}

function findJsonStart(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{' || s[i] === '[') return i;
  }
  return -1;
}

function findMatchingClose(
  s: string,
  start: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function parseStructuredOutput<T>(
  raw: string,
  schema: ZodSchema<T>,
): T {
  const jsonStr = extractJson(raw);
  let parsed: unknown = JSON.parse(jsonStr);

  // Auto-wrap: if the LLM returned a bare array but the schema expects
  // an object with an array property (e.g. { entities: [...] } or
  // { relationships: [...] }), wrap it automatically.
  if (Array.isArray(parsed)) {
    parsed = inferObjectWrapper(parsed, schema);
  }

  const result = schema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`,
    ).join('; ');
    throw new CortexError(
      LLM_EXTRACTION_FAILED,
      'medium',
      'llm',
      `Schema validation failed: ${issues}`,
      { raw: raw.slice(0, 500), issues: result.error.issues },
      'Retry with correction prompt',
      true,
    );
  }

  return result.data;
}

/**
 * When the LLM returns a bare array but the schema expects an object,
 * try wrapping the array under the first array-typed key found in the schema.
 * Handles the common case: prompt says "return array" but schema is { entities: [...] }.
 */
function inferObjectWrapper(arr: unknown[], schema: ZodSchema<unknown>): unknown {
  // Access the Zod schema shape if it's a ZodObject
  const def = (schema as { _def?: { typeName?: string; shape?: () => Record<string, ZodSchema<unknown>> } })._def;
  if (def?.typeName === 'ZodObject' && typeof def.shape === 'function') {
    const shape = def.shape();
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fieldDef = (fieldSchema as { _def?: { typeName?: string } })._def;
      if (fieldDef?.typeName === 'ZodArray') {
        return { [key]: arr };
      }
    }
  }
  // Fallback: try common wrapper keys
  return { entities: arr };
}

export function buildCorrectionPrompt(
  originalPrompt: string,
  failedOutput: string,
  error: string,
): string {
  return `${originalPrompt}

Your previous response was invalid JSON or didn't match the schema.

Previous response (DO NOT repeat this):
${failedOutput.slice(0, 500)}

Error: ${error}

Please return ONLY valid JSON matching the required schema. No explanation.`;
}
