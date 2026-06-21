import TreeSitter from 'tree-sitter';
import TreeSitterPython from 'tree-sitter-python';
import type { Parser as FileParser, ParseResult, ParsedSection } from './types.js';

const pythonLanguage = TreeSitterPython;

function createParser(language: unknown): TreeSitter {
  const parser = new TreeSitter();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  parser.setLanguage(language as Parameters<typeof parser.setLanguage>[0]);
  return parser;
}

type SyntaxNode = TreeSitter.SyntaxNode;

function nodeText(node: SyntaxNode, source: string): string {
  return source.slice(node.startIndex, node.endIndex);
}

function extractName(node: SyntaxNode, source: string): string | undefined {
  const nameNode = node.childForFieldName('name');
  if (nameNode) return nodeText(nameNode, source);
  return undefined;
}

export class PythonParser implements FileParser {
  readonly supportedExtensions = ['py'];
  private parser: TreeSitter;

  constructor() {
    this.parser = createParser(pythonLanguage);
  }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const tree = this.parser.parse(content);
    const sections: ParsedSection[] = [];

    this.walkNode(tree.rootNode, content, sections);

    return {
      sections,
      metadata: {
        filePath,
        format: 'python',
        sectionCount: sections.length,
      },
    };
  }

  private walkNode(
    node: SyntaxNode,
    source: string,
    sections: ParsedSection[],
  ): void {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;

      switch (child.type) {
        case 'function_definition':
          sections.push({
            type: 'function',
            title: extractName(child, source),
            content: nodeText(child, source),
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
          });
          break;

        case 'class_definition':
          sections.push({
            type: 'class',
            title: extractName(child, source),
            content: nodeText(child, source),
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
          });
          {
            const body = child.childForFieldName('body');
            if (body) this.walkNode(body, source, sections);
          }
          break;

        case 'decorated_definition': {
          const definition = child.namedChildren.find((n) =>
            n.type === 'function_definition' || n.type === 'class_definition',
          );
          if (definition) {
            const defType = definition.type === 'class_definition' ? 'class' : 'function';
            sections.push({
              type: defType,
              title: extractName(definition, source),
              content: nodeText(child, source),
              startLine: child.startPosition.row + 1,
              endLine: child.endPosition.row + 1,
              metadata: { decorated: true },
            });
          }
          break;
        }

        case 'comment':
          sections.push({
            type: 'comment',
            content: nodeText(child, source),
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
          });
          break;

        case 'import_statement':
        case 'import_from_statement':
          // Skip imports — not useful for entity extraction
          break;

        default:
          if (child.childCount > 0) {
            this.walkNode(child, source, sections);
          }
          break;
      }
    }
  }
}
