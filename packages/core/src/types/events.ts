import type { Entity } from './entity.js';
import type { Relationship, Contradiction } from './relationship.js';

export interface CortexEvent {
  type: string;
  payload: unknown;
  timestamp: string;
  source: string;
}

export interface FileChangedPayload {
  path: string;
  changeType: 'add' | 'change' | 'unlink';
}

export interface FileIngestedPayload {
  fileId: string;
  entityIds: string[];
  relationshipIds: string[];
}

export interface EntityCreatedPayload {
  entity: Entity;
}

export interface EntityUpdatedPayload {
  entity: Entity;
  changes: string[];
}

export interface EntityMergedPayload {
  survivorId: string;
  mergedId: string;
}

export interface RelationshipCreatedPayload {
  relationship: Relationship;
}

export interface ContradictionDetectedPayload {
  contradiction: Contradiction;
}

export interface LLMRequestStartPayload {
  requestId: string;
  task: string;
  provider: string;
}

export interface LLMRequestCompletePayload {
  requestId: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
  latencyMs: number;
}

export interface LLMRequestErrorPayload {
  requestId: string;
  error: { code: string; message: string };
}

export interface BudgetWarningPayload {
  usedPercent: number;
  remainingUsd: number;
}

export interface BudgetExhaustedPayload {
  totalSpentUsd: number;
}

export interface ErrorOccurredPayload {
  code: string;
  severity: string;
  layer: string;
  message: string;
}

export type EventHandler = (event: CortexEvent) => void;

export interface EventBusInterface {
  emit(event: CortexEvent): void;
  on(type: string, handler: EventHandler): () => void;
  off(type: string, handler: EventHandler): void;
  once(type: string, handler: EventHandler): void;
}
