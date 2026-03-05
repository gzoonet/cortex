import type { Parser, ParseResult, ParsedSection } from './types.js';

// Conversation role patterns for markdown export detection
const HUMAN_PATTERN = /^(Human|User|Me)$/i;
const ASSISTANT_PATTERN = /^(Assistant|Claude|ChatGPT|GPT)$/i;

/** Sniff whether content looks like a Claude/ChatGPT JSON export */
export function isConversationJson(content: string): boolean {
  try {
    const obj = JSON.parse(content);
    // ChatGPT export: top-level array or { conversations: [...] }
    if (Array.isArray(obj) && obj.length > 0) {
      const first = obj[0];
      return (
        (Array.isArray(first?.mapping) || typeof first?.mapping === 'object') ||
        Array.isArray(first?.messages)
      );
    }
    if (Array.isArray(obj?.conversations)) return true;
    // Claude export: top-level object with messages array containing role fields
    if (Array.isArray(obj?.messages) && obj.messages[0]?.role !== undefined) return true;
    return false;
  } catch {
    return false;
  }
}

/** Sniff whether content is a markdown conversation export */
export function isConversationMarkdown(content: string): boolean {
  const lines = content.split('\n');
  const headings: string[] = [];
  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+)$/);
    if (m) {
      headings.push(m[1].trim());
      if (headings.length >= 2) break;
    }
  }
  if (headings.length < 2) return false;
  return HUMAN_PATTERN.test(headings[0]) && ASSISTANT_PATTERN.test(headings[1]);
}

/** Parse a Claude/ChatGPT JSON export into sections */
function parseConversationJson(content: string): ParsedSection[] {
  const obj = JSON.parse(content);
  const sections: ParsedSection[] = [];

  // Normalize to array of messages: [{ role, content }]
  type RawMessage = { role?: string; author?: { role?: string }; content: unknown; text?: string };
  let messages: RawMessage[] = [];

  if (Array.isArray(obj)) {
    // Could be ChatGPT export array of conversations — flatten messages from first conversation
    const first = obj[0];
    if (first?.mapping && typeof first.mapping === 'object') {
      // ChatGPT format: { mapping: { [id]: { message: { author: { role }, content: { parts } } } } }
      for (const node of Object.values(first.mapping) as { message?: { author?: { role?: string }; content?: { parts?: string[] } } }[]) {
        const msg = node?.message;
        if (!msg?.author?.role || !msg.content?.parts) continue;
        const text = msg.content.parts.join('\n').trim();
        if (text) messages.push({ role: msg.author.role, content: text });
      }
    } else if (Array.isArray(first?.messages)) {
      messages = first.messages as RawMessage[];
    }
  } else if (Array.isArray(obj?.conversations)) {
    messages = (obj.conversations[0]?.messages ?? []) as RawMessage[];
  } else if (Array.isArray(obj?.messages)) {
    messages = obj.messages as RawMessage[];
  }

  let lineNum = 1;
  for (const msg of messages) {
    const role = (msg.role ?? msg.author?.role ?? 'unknown').toLowerCase();
    if (role === 'system') continue;

    const text = typeof msg.content === 'string'
      ? msg.content
      : (msg.text ?? JSON.stringify(msg.content));

    if (!text || text.trim().length < 50) continue;

    const endLine = lineNum + text.split('\n').length;
    sections.push({
      type: 'paragraph',
      title: role === 'user' ? 'Human' : 'Assistant',
      content: text.trim(),
      startLine: lineNum,
      endLine,
      metadata: { role, speaker: role === 'user' ? 'human' : 'assistant' },
    });
    lineNum = endLine + 1;
  }

  return sections;
}

/** Parse a markdown conversation export into sections */
function parseConversationMarkdown(content: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = content.split('\n');

  let currentRole: string | null = null;
  let blockStart = 0;
  const blockLines: string[] = [];

  const flush = (endLine: number): void => {
    if (!currentRole || blockLines.length === 0) return;
    const text = blockLines.join('\n').trim();
    if (text.length >= 50) {
      sections.push({
        type: 'paragraph',
        title: currentRole,
        content: text,
        startLine: blockStart,
        endLine,
        metadata: {
          role: HUMAN_PATTERN.test(currentRole) ? 'user' : 'assistant',
          speaker: HUMAN_PATTERN.test(currentRole) ? 'human' : 'assistant',
        },
      });
    }
    blockLines.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      flush(i);
      currentRole = headingMatch[1].trim();
      blockStart = i + 2;
    } else if (currentRole) {
      blockLines.push(line);
    }
  }
  flush(lines.length);

  return sections;
}

export class ConversationParser implements Parser {
  readonly supportedExtensions = ['json', 'md'];

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const isJson = filePath.endsWith('.json') || filePath.endsWith('.JSON');
    const sections = isJson
      ? parseConversationJson(content)
      : parseConversationMarkdown(content);

    return {
      sections,
      metadata: {
        format: isJson ? 'conversation-json' : 'conversation-markdown',
        messageCount: sections.length,
      },
    };
  }
}
