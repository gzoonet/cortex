import type { Parser, ParseResult, ParsedSection } from './types.js';

/**
 * Strip JSONC features (comments + trailing commas) so JSON.parse works.
 * Respects string boundaries to avoid stripping inside quoted values.
 */
function stripJsonComments(text: string): string {
  let result = '';
  let i = 0;
  let inString = false;

  while (i < text.length) {
    const ch = text[i]!;
    const next = text[i + 1];

    // Handle string boundaries (skip escaped quotes)
    if (ch === '"' && (i === 0 || text[i - 1] !== '\\')) {
      inString = !inString;
      result += ch;
      i++;
      continue;
    }

    if (inString) {
      result += ch;
      i++;
      continue;
    }

    // Block comment: /* ... */
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        result += text[i] === '\n' ? '\n' : ' ';
        i++;
      }
      i += 2;
      continue;
    }

    // Line comment: // ...
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }

    result += ch;
    i++;
  }

  // Strip trailing commas before } or ]
  result = result.replace(/,\s*([\]\}])/g, '$1');

  return result;
}

function parseJsonOrJsonc(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // Retry with JSONC stripping (comments + trailing commas)
    return JSON.parse(stripJsonComments(content));
  }
}


export class JsonParser implements Parser {
  readonly supportedExtensions = ['json'];

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const parsed: unknown = parseJsonOrJsonc(content);
    const sections: ParsedSection[] = [];

    if (typeof parsed !== 'object' || parsed === null) {
      sections.push({
        type: 'unknown',
        content,
        startLine: 1,
        endLine: content.split('\n').length,
      });
      return { sections, metadata: { filePath, format: 'json' } };
    }

    const obj = parsed as Record<string, unknown>;
    const lines = content.split('\n');

    // Extract top-level keys as sections
    for (const [key, value] of Object.entries(obj)) {
      const valueStr = JSON.stringify(value, null, 2);

      // Approximate line range by searching for the key in content
      const keyPattern = `"${key}"`;
      let startLine = 1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.includes(keyPattern)) {
          startLine = i + 1;
          break;
        }
      }

      const valueLines = valueStr.split('\n').length;

      sections.push({
        type: 'property',
        title: key,
        content: `${key}: ${valueStr}`,
        startLine,
        endLine: startLine + valueLines - 1,
        metadata: {
          key,
          valueType: Array.isArray(value) ? 'array' : typeof value,
        },
      });
    }

    // Detect known JSON files and add metadata
    const metadata: Record<string, unknown> = {
      filePath,
      format: 'json',
      sectionCount: sections.length,
    };

    if (filePath.endsWith('package.json')) {
      metadata.packageName = obj['name'];
      metadata.packageVersion = obj['version'];
    } else if (filePath.endsWith('tsconfig.json') || filePath.endsWith('tsconfig.base.json')) {
      metadata.tsconfigType = 'typescript-config';
    }

    return { sections, metadata };
  }
}
