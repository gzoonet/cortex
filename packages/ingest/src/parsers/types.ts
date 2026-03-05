export interface ParsedSection {
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'function' | 'class' | 'interface' | 'export' | 'comment' | 'property' | 'item' | 'unknown';
  title?: string;
  content: string;
  startLine: number;
  endLine: number;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface ParseResult {
  sections: ParsedSection[];
  metadata: Record<string, unknown>;
}

export interface Parser {
  parse(content: string, filePath: string): Promise<ParseResult>;
  supportedExtensions: string[];
}
