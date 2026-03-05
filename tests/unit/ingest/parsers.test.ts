import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MarkdownParser } from '@cortex/ingest';
import { TypeScriptParser } from '@cortex/ingest';
import { JsonParser } from '@cortex/ingest';
import { getParser, getSupportedExtensions } from '@cortex/ingest';

const fixturesDir = resolve(import.meta.dirname, '../../fixtures');

describe('MarkdownParser', () => {
  const parser = new MarkdownParser();

  it('should parse a markdown file into sections', async () => {
    const content = readFileSync(resolve(fixturesDir, 'sample-architecture.md'), 'utf-8');
    const result = await parser.parse(content, 'sample-architecture.md');

    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('should extract headings', async () => {
    const content = readFileSync(resolve(fixturesDir, 'sample-architecture.md'), 'utf-8');
    const result = await parser.parse(content, 'sample-architecture.md');

    const headings = result.sections.filter((s) => s.type === 'heading');
    expect(headings.length).toBeGreaterThan(0);

    // Should find the main title
    const mainTitle = headings.find((h) => h.title?.includes('Payment Processing'));
    expect(mainTitle).toBeDefined();
  });

  it('should extract code blocks', async () => {
    const content = '# Test\n\n```typescript\nconst x = 1;\n```\n\nSome text.';
    const result = await parser.parse(content, 'test.md');

    const codeBlocks = result.sections.filter((s) => s.type === 'code');
    expect(codeBlocks.length).toBe(1);
    expect(codeBlocks[0]!.language).toBe('typescript');
  });

  it('should extract lists', async () => {
    const content = '# Items\n\n- First item\n- Second item\n- Third item\n';
    const result = await parser.parse(content, 'test.md');

    const lists = result.sections.filter((s) => s.type === 'list');
    expect(lists.length).toBeGreaterThan(0);
  });
});

describe('TypeScriptParser', () => {
  const parser = new TypeScriptParser();

  it('should parse a TypeScript file', async () => {
    const content = readFileSync(resolve(fixturesDir, 'sample-component.ts'), 'utf-8');
    const result = await parser.parse(content, 'sample-component.ts');

    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('should extract interfaces', async () => {
    const content = readFileSync(resolve(fixturesDir, 'sample-component.ts'), 'utf-8');
    const result = await parser.parse(content, 'sample-component.ts');

    const interfaces = result.sections.filter((s) => s.type === 'interface');
    expect(interfaces.length).toBeGreaterThan(0);

    const bookingRequest = interfaces.find((i) => i.title === 'BookingRequest');
    expect(bookingRequest).toBeDefined();
  });

  it('should extract classes', async () => {
    const content = readFileSync(resolve(fixturesDir, 'sample-component.ts'), 'utf-8');
    const result = await parser.parse(content, 'sample-component.ts');

    const classes = result.sections.filter((s) => s.type === 'class');
    expect(classes.length).toBeGreaterThan(0);

    const bookingService = classes.find((c) => c.title === 'BookingService');
    expect(bookingService).toBeDefined();
  });

  it('should extract functions/methods', async () => {
    const content = 'export function hello(name: string): string {\n  return `Hello ${name}`;\n}\n';
    const result = await parser.parse(content, 'test.ts');

    const functions = result.sections.filter((s) => s.type === 'function');
    expect(functions.length).toBeGreaterThan(0);
  });

  it('should extract comments', async () => {
    const content = readFileSync(resolve(fixturesDir, 'sample-component.ts'), 'utf-8');
    const result = await parser.parse(content, 'sample-component.ts');

    const comments = result.sections.filter((s) => s.type === 'comment');
    expect(comments.length).toBeGreaterThan(0);
  });
});

describe('JsonParser', () => {
  const parser = new JsonParser();

  it('should parse a JSON file into sections by top-level keys', async () => {
    const content = readFileSync(resolve(fixturesDir, 'sample-config.json'), 'utf-8');
    const result = await parser.parse(content, 'package.json');

    expect(result.sections.length).toBeGreaterThan(0);

    // Should detect it's a package.json
    const metadata = result.metadata;
    expect(metadata).toBeDefined();
  });

  it('should handle nested objects', async () => {
    const content = JSON.stringify({
      name: 'test',
      scripts: { build: 'tsc', test: 'vitest' },
    });
    const result = await parser.parse(content, 'package.json');
    expect(result.sections.length).toBeGreaterThan(0);
  });
});

describe('Parser Registry', () => {
  it('should return parser for supported extensions', () => {
    expect(getParser('md')).toBeDefined();
    expect(getParser('ts')).toBeDefined();
    expect(getParser('tsx')).toBeDefined();
    expect(getParser('js')).toBeDefined();
    expect(getParser('json')).toBeDefined();
    expect(getParser('yaml')).toBeDefined();
    expect(getParser('yml')).toBeDefined();
  });

  it('should return undefined for unsupported extensions', () => {
    expect(getParser('exe')).toBeUndefined();
    expect(getParser('png')).toBeUndefined();
  });

  it('should list all supported extensions', () => {
    const exts = getSupportedExtensions();
    expect(exts).toContain('md');
    expect(exts).toContain('ts');
    expect(exts).toContain('json');
    expect(exts.length).toBeGreaterThanOrEqual(7);
  });
});
