export type EntityType =
  | 'Decision'
  | 'Requirement'
  | 'Pattern'
  | 'Component'
  | 'Dependency'
  | 'Interface'
  | 'Constraint'
  | 'ActionItem'
  | 'Risk'
  | 'Note';

export interface ExtractionMetadata {
  promptId: string;
  promptVersion: string;
  model: string;
  provider: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  timestamp: string;
}

export interface SourceRange {
  startLine: number;
  endLine: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  content: string;
  summary?: string;
  properties: Record<string, unknown>;
  confidence: number;
  sourceFile: string;
  sourceRange?: SourceRange;
  projectId: string;
  extractedBy: ExtractionMetadata;
  embedding?: Float32Array;
  tags: string[];
  status: 'active' | 'superseded' | 'deleted';
  createdAt: string;
  updatedAt: string;
}
