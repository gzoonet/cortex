import type { ExtractionMetadata } from './entity.js';

export type RelationshipType =
  | 'depends_on'
  | 'implements'
  | 'contradicts'
  | 'evolved_from'
  | 'relates_to'
  | 'uses'
  | 'constrains'
  | 'resolves'
  | 'documents'
  | 'derived_from';

export interface Relationship {
  id: string;
  type: RelationshipType;
  sourceEntityId: string;
  targetEntityId: string;
  description?: string;
  confidence: number;
  properties: Record<string, unknown>;
  extractedBy: ExtractionMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface Contradiction {
  id: string;
  entityIds: [string, string];
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestedResolution?: string;
  status: 'active' | 'resolved' | 'dismissed';
  resolvedAction?: 'supersede' | 'dismiss' | 'keep_old' | 'both_valid';
  resolvedAt?: string;
  detectedAt: string;
}
