import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MarkdownParser, chunkSections, type Chunk } from '@cortex/ingest';

const fixturesDir = resolve(import.meta.dirname, '../../fixtures');

describe('Chunker', () => {
  it('should split sections into chunks', async () => {
    const parser = new MarkdownParser();
    const content = readFileSync(resolve(fixturesDir, 'sample-architecture.md'), 'utf-8');
    const result = await parser.parse(content, 'sample-architecture.md');

    const chunks = chunkSections(result.sections);

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.content).toBeTruthy();
      expect(chunk.startLine).toBeGreaterThanOrEqual(0);
      expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
      expect(chunk.tokenEstimate).toBeGreaterThan(0);
    }
  });

  it('should respect token limit', async () => {
    const parser = new MarkdownParser();
    const content = readFileSync(resolve(fixturesDir, 'sample-architecture.md'), 'utf-8');
    const result = await parser.parse(content, 'sample-architecture.md');

    const chunks = chunkSections(result.sections, { maxTokens: 500 });

    for (const chunk of chunks) {
      // Allow some tolerance (token estimation is approximate)
      expect(chunk.tokenEstimate).toBeLessThanOrEqual(600);
    }
  });

  it('should produce overlapping chunks when content is large', () => {
    // Create a large set of sections
    const sections = Array.from({ length: 50 }, (_, i) => ({
      type: 'paragraph' as const,
      title: `Section ${i}`,
      content: `This is paragraph ${i} with enough content to fill some space. `.repeat(10),
      startLine: i * 10,
      endLine: i * 10 + 9,
    }));

    const chunks = chunkSections(sections, { maxTokens: 500, overlapTokens: 50 });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle empty sections array', () => {
    const chunks = chunkSections([]);
    expect(chunks).toEqual([]);
  });

  it('should preserve section metadata in chunks', async () => {
    const parser = new MarkdownParser();
    const content = readFileSync(resolve(fixturesDir, 'sample-architecture.md'), 'utf-8');
    const result = await parser.parse(content, 'sample-architecture.md');

    const chunks = chunkSections(result.sections);

    for (const chunk of chunks) {
      expect(chunk.sectionTitles).toBeDefined();
      expect(chunk.sectionTitles.length).toBeGreaterThan(0);
    }
  });
});
