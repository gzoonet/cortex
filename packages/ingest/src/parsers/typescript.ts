import TreeSitter from 'tree-sitter';
import TreeSitterTypeScript from 'tree-sitter-typescript';
import type { Parser as FileParser, ParseResult, ParsedSection } from './types.js';

// tree-sitter is CJS; extract language grammars
const tsLanguage = TreeSitterTypeScript.typescript;
const tsxLanguage = TreeSitterTypeScript.tsx;

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

  // For variable declarations like `const x = ...`
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === 'variable_declarator') {
      const varName = child.childForFieldName('name');
      if (varName) return nodeText(varName, source);
    }
  }
  return undefined;
}

export class TypeScriptParser implements FileParser {
  readonly supportedExtensions = ['ts', 'tsx', 'js', 'jsx'];
  private tsParser: TreeSitter;
  private tsxParser: TreeSitter;

  constructor() {
    this.tsParser = createParser(tsLanguage);
    this.tsxParser = createParser(tsxLanguage);
  }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
    const parser = isTsx ? this.tsxParser : this.tsParser;
    const tree = parser.parse(content);
    const sections: ParsedSection[] = [];

    this.walkNode(tree.rootNode, content, sections);

    return {
      sections,
      metadata: {
        filePath,
        format: isTsx ? 'tsx' : 'typescript',
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
        case 'function_declaration':
        case 'generator_function_declaration':
          sections.push({
            type: 'function',
            title: extractName(child, source),
            content: nodeText(child, source),
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
          });
          break;

        case 'class_declaration':
          sections.push({
            type: 'class',
            title: extractName(child, source),
            content: nodeText(child, source),
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
          });
          break;

        case 'interface_declaration':
        case 'type_alias_declaration':
          sections.push({
            type: 'interface',
            title: extractName(child, source),
            content: nodeText(child, source),
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
          });
          break;

        case 'enum_declaration':
          sections.push({
            type: 'interface',
            title: extractName(child, source),
            content: nodeText(child, source),
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            metadata: { kind: 'enum' },
          });
          break;

        case 'export_statement': {
          const declaration = child.childForFieldName('declaration');
          if (declaration) {
            // Recurse into the exported declaration
            this.walkExportedNode(declaration, child, source, sections);
          } else {
            sections.push({
              type: 'export',
              content: nodeText(child, source),
              startLine: child.startPosition.row + 1,
              endLine: child.endPosition.row + 1,
            });
          }
          break;
        }

        case 'lexical_declaration': {
          // const/let/var — only capture if it's a significant declaration
          const text = nodeText(child, source);
          if (text.length > 50) {
            sections.push({
              type: 'export',
              title: extractName(child, source),
              content: text,
              startLine: child.startPosition.row + 1,
              endLine: child.endPosition.row + 1,
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
          // Skip imports — not useful for entity extraction
          break;

        default:
          // Recurse into other statement types
          if (child.childCount > 0) {
            this.walkNode(child, source, sections);
          }
          break;
      }
    }
  }

  private walkExportedNode(
    declaration: SyntaxNode,
    exportNode: SyntaxNode,
    source: string,
    sections: ParsedSection[],
  ): void {
    const fullText = nodeText(exportNode, source);
    const name = extractName(declaration, source);

    switch (declaration.type) {
      case 'function_declaration':
      case 'generator_function_declaration':
        sections.push({
          type: 'function',
          title: name,
          content: fullText,
          startLine: exportNode.startPosition.row + 1,
          endLine: exportNode.endPosition.row + 1,
          metadata: { exported: true },
        });
        break;

      case 'class_declaration':
        sections.push({
          type: 'class',
          title: name,
          content: fullText,
          startLine: exportNode.startPosition.row + 1,
          endLine: exportNode.endPosition.row + 1,
          metadata: { exported: true },
        });
        break;

      case 'interface_declaration':
      case 'type_alias_declaration':
        sections.push({
          type: 'interface',
          title: name,
          content: fullText,
          startLine: exportNode.startPosition.row + 1,
          endLine: exportNode.endPosition.row + 1,
          metadata: { exported: true },
        });
        break;

      default:
        sections.push({
          type: 'export',
          title: name,
          content: fullText,
          startLine: exportNode.startPosition.row + 1,
          endLine: exportNode.endPosition.row + 1,
          metadata: { exported: true },
        });
        break;
    }
  }
}
