import type { Parser, ParseResult, ParsedSection } from './types.js';

// Strip single-line (//) and block (/* */) comments so JSONC files (tsconfig, etc.) parse cleanly.
function stripJsonComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')) // block comments → spaces (preserve line numbers)
    .replace(/\/\/[^\n]*/g, '');                                      // line comments → empty
}

function parseJsonOrJsonc(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // Retry with comment stripping (JSONC: tsconfig, etc.)
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
