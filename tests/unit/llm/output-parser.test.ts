import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseStructuredOutput } from '@cortex/llm';

const testSchema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    type: z.string(),
    confidence: z.number(),
  })),
});

describe('Output Parser', () => {
  it('should parse clean JSON', () => {
    const raw = JSON.stringify({
      entities: [{ name: 'Test', type: 'Decision', confidence: 0.9 }],
    });

    const result = parseStructuredOutput(raw, testSchema);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]!.name).toBe('Test');
  });

  it('should strip markdown fences before parsing', () => {
    const raw = '```json\n{"entities": [{"name": "Test", "type": "Decision", "confidence": 0.9}]}\n```';

    const result = parseStructuredOutput(raw, testSchema);
    expect(result.entities).toHaveLength(1);
  });

  it('should strip plain fences', () => {
    const raw = '```\n{"entities": [{"name": "Test", "type": "Decision", "confidence": 0.9}]}\n```';

    const result = parseStructuredOutput(raw, testSchema);
    expect(result.entities).toHaveLength(1);
  });

  it('should extract JSON from surrounding text', () => {
    const raw = 'Here is the output:\n\n{"entities": [{"name": "Test", "type": "Decision", "confidence": 0.9}]}\n\nI hope this helps!';

    const result = parseStructuredOutput(raw, testSchema);
    expect(result.entities).toHaveLength(1);
  });

  it('should throw on invalid JSON', () => {
    const raw = 'not json at all';
    expect(() => parseStructuredOutput(raw, testSchema)).toThrow();
  });

  it('should throw on schema validation failure', () => {
    const raw = JSON.stringify({ entities: [{ name: 'Test' }] }); // missing type and confidence
    expect(() => parseStructuredOutput(raw, testSchema)).toThrow();
  });
});
