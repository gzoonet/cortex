import type { Parser } from './types.js';
import { MarkdownParser } from './markdown.js';
import { TypeScriptParser } from './typescript.js';
import { JsonParser } from './json-parser.js';
import { YamlParser } from './yaml-parser.js';
import { ConversationParser, isConversationJson, isConversationMarkdown } from './conversation.js';

export type { Parser, ParseResult, ParsedSection } from './types.js';

const markdownParser = new MarkdownParser();
const typescriptParser = new TypeScriptParser();
const jsonParser = new JsonParser();
const yamlParser = new YamlParser();
const conversationParser = new ConversationParser();

const PARSER_REGISTRY: Map<string, Parser> = new Map([
  ['md', markdownParser],
  ['mdx', markdownParser],
  ['ts', typescriptParser],
  ['tsx', typescriptParser],
  ['js', typescriptParser],
  ['jsx', typescriptParser],
  ['json', jsonParser],
  ['yaml', yamlParser],
  ['yml', yamlParser],
]);

/**
 * Return the appropriate parser for the given file extension.
 * When filePath + content are provided, sniff conversation formats first
 * so that Claude/ChatGPT JSON exports and markdown conversations route to
 * the ConversationParser rather than the generic JSON/Markdown parsers.
 */
export function getParser(extension: string, filePath?: string, content?: string): Parser | undefined {
  const ext = extension.toLowerCase();

  // Sniff for conversation formats when content is available
  if (content !== undefined && filePath !== undefined) {
    if ((ext === 'json') && isConversationJson(content)) return conversationParser;
    if ((ext === 'md' || ext === 'mdx') && isConversationMarkdown(content)) return conversationParser;
  }

  return PARSER_REGISTRY.get(ext);
}

export function getSupportedExtensions(): string[] {
  return [...PARSER_REGISTRY.keys()];
}
