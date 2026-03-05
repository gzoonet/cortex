/**
 * Integration test: Conversation export parsing (US-204)
 * No LLM calls — tests parser only.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { getParser } from '../../packages/ingest/src/parsers/index.js';
import { isConversationJson, isConversationMarkdown } from '../../packages/ingest/src/parsers/conversation.js';

const FIXTURES = resolve(import.meta.dirname, '../fixtures');

describe('conversation export parsing', () => {
  it('detects Claude JSON export format', () => {
    const content = readFileSync(resolve(FIXTURES, 'conversation-claude-export.json'), 'utf-8');
    expect(isConversationJson(content)).toBe(true);
  });

  it('does not misidentify regular JSON as conversation', () => {
    const regular = JSON.stringify({ name: 'test', version: '1.0', dependencies: {} });
    expect(isConversationJson(regular)).toBe(false);
  });

  it('detects markdown conversation format', () => {
    const content = readFileSync(resolve(FIXTURES, 'conversation-markdown.md'), 'utf-8');
    expect(isConversationMarkdown(content)).toBe(true);
  });

  it('does not misidentify regular markdown as conversation', () => {
    const regular = '# Project Docs\n\n## Architecture\n\nWe use TypeScript.\n\n## Testing\n\nWe use Vitest.';
    expect(isConversationMarkdown(regular)).toBe(false);
  });

  it('routes JSON conversation to ConversationParser via getParser sniffing', async () => {
    const filePath = resolve(FIXTURES, 'conversation-claude-export.json');
    const content = readFileSync(filePath, 'utf-8');
    const parser = getParser('json', filePath, content);
    expect(parser).toBeDefined();

    const result = await parser!.parse(content, filePath);
    expect(result.sections.length).toBeGreaterThan(0);
    // Should skip system messages and short messages; 4 messages all > 50 chars
    expect(result.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.metadata.format).toBe('conversation-json');
  });

  it('routes markdown conversation to ConversationParser via getParser sniffing', async () => {
    const filePath = resolve(FIXTURES, 'conversation-markdown.md');
    const content = readFileSync(filePath, 'utf-8');
    const parser = getParser('md', filePath, content);
    expect(parser).toBeDefined();

    const result = await parser!.parse(content, filePath);
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.metadata.format).toBe('conversation-markdown');
    // 4 speaker blocks (2 human, 2 assistant)
    expect(result.sections.length).toBe(4);
  });

  it('regular JSON still routes to JSON parser', async () => {
    const content = '{"name": "test", "version": "1.0"}';
    const parser = getParser('json', 'package.json', content);
    expect(parser).toBeDefined();
    // Should be the JSON parser, not conversation — it will parse without error
    const result = await parser!.parse(content, 'package.json');
    expect(result).toBeDefined();
  });
});
