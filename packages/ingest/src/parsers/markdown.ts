import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, Content } from 'mdast';
import type { Parser, ParseResult, ParsedSection } from './types.js';

function getLineRange(node: Content): { startLine: number; endLine: number } {
  return {
    startLine: node.position?.start.line ?? 1,
    endLine: node.position?.end.line ?? 1,
  };
}

function extractText(node: Content): string {
  if ('value' in node) return node.value;
  if ('children' in node) {
    return (node.children as Content[]).map(extractText).join('');
  }
  return '';
}

export class MarkdownParser implements Parser {
  readonly supportedExtensions = ['md', 'mdx'];

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const tree = unified().use(remarkParse).parse(content) as Root;
    const sections: ParsedSection[] = [];
    let currentHeading: string | undefined;

    for (const node of tree.children) {
      const lines = getLineRange(node);

      switch (node.type) {
        case 'heading': {
          const text = extractText(node);
          currentHeading = text;
          sections.push({
            type: 'heading',
            title: text,
            content: text,
            startLine: lines.startLine,
            endLine: lines.endLine,
            metadata: { depth: node.depth },
          });
          break;
        }

        case 'paragraph': {
          const text = extractText(node);
          sections.push({
            type: 'paragraph',
            title: currentHeading,
            content: text,
            startLine: lines.startLine,
            endLine: lines.endLine,
          });
          break;
        }

        case 'code': {
          sections.push({
            type: 'code',
            title: currentHeading,
            content: node.value,
            language: node.lang ?? undefined,
            startLine: lines.startLine,
            endLine: lines.endLine,
            metadata: { lang: node.lang },
          });
          break;
        }

        case 'list': {
          const items = node.children
            .map((item) => extractText(item))
            .join('\n');
          sections.push({
            type: 'list',
            title: currentHeading,
            content: items,
            startLine: lines.startLine,
            endLine: lines.endLine,
            metadata: { ordered: node.ordered },
          });
          break;
        }

        case 'blockquote': {
          const text = (node.children as Content[]).map(extractText).join('\n');
          sections.push({
            type: 'paragraph',
            title: currentHeading,
            content: text,
            startLine: lines.startLine,
            endLine: lines.endLine,
            metadata: { blockquote: true },
          });
          break;
        }

        case 'table': {
          // Flatten table to text representation
          const rows = node.children.map((row) =>
            (row.children as Content[]).map(extractText).join(' | '),
          );
          sections.push({
            type: 'paragraph',
            title: currentHeading,
            content: rows.join('\n'),
            startLine: lines.startLine,
            endLine: lines.endLine,
            metadata: { table: true },
          });
          break;
        }

        default:
          // thematicBreak, html, etc. — skip
          break;
      }
    }

    return {
      sections,
      metadata: {
        filePath,
        format: 'markdown',
        sectionCount: sections.length,
      },
    };
  }
}
