import { parse as parseYaml } from 'yaml';
import type { Parser, ParseResult, ParsedSection } from './types.js';

export class YamlParser implements Parser {
  readonly supportedExtensions = ['yaml', 'yml'];

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const parsed: unknown = parseYaml(content);
    const sections: ParsedSection[] = [];

    if (typeof parsed !== 'object' || parsed === null) {
      sections.push({
        type: 'unknown',
        content,
        startLine: 1,
        endLine: content.split('\n').length,
      });
      return { sections, metadata: { filePath, format: 'yaml' } };
    }

    const obj = parsed as Record<string, unknown>;
    const lines = content.split('\n');

    for (const [key, value] of Object.entries(obj)) {
      const valueStr = typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);

      // Find line where key starts
      let startLine = 1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.startsWith(`${key}:`) || lines[i]!.startsWith(`${key} :`)) {
          startLine = i + 1;
          break;
        }
      }

      sections.push({
        type: 'property',
        title: key,
        content: `${key}: ${valueStr}`,
        startLine,
        endLine: startLine + valueStr.split('\n').length - 1,
        metadata: {
          key,
          valueType: Array.isArray(value) ? 'array' : typeof value,
        },
      });
    }

    return {
      sections,
      metadata: {
        filePath,
        format: 'yaml',
        sectionCount: sections.length,
      },
    };
  }
}
