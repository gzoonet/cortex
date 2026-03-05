import type { SQLiteStore } from '@cortex/graph';

interface GetContradictionsInput {
  status?: string;
  entityId?: string;
  limit?: number;
}

interface ResolveContradictionInput {
  id: string;
  action: string;
}

export async function handleGetContradictions(
  input: GetContradictionsInput,
  store: SQLiteStore,
): Promise<string> {
  const contradictions = await store.findContradictions({
    status: input.status as 'active' | 'resolved' | 'dismissed' | undefined,
    entityId: input.entityId,
    limit: input.limit ?? 50,
  });

  const enriched = await Promise.all(
    contradictions.map(async (c) => {
      const [entityA, entityB] = await Promise.all([
        store.getEntity(c.entityIds[0]).catch(() => null),
        store.getEntity(c.entityIds[1]).catch(() => null),
      ]);
      return {
        ...c,
        entityA: entityA ? { id: entityA.id, name: entityA.name, type: entityA.type, summary: entityA.summary } : null,
        entityB: entityB ? { id: entityB.id, name: entityB.name, type: entityB.type, summary: entityB.summary } : null,
      };
    }),
  );

  return JSON.stringify({ count: enriched.length, contradictions: enriched }, null, 2);
}

export async function handleResolveContradiction(
  input: ResolveContradictionInput,
  store: SQLiteStore,
): Promise<string> {
  const validActions = ['supersede', 'dismiss', 'keep_old', 'both_valid'];
  if (!validActions.includes(input.action)) {
    return JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` });
  }

  const status = input.action === 'dismiss' ? 'dismissed' : 'resolved';
  await store.updateContradiction(input.id, {
    status: status as 'active' | 'resolved' | 'dismissed',
    resolvedAction: input.action as 'supersede' | 'dismiss' | 'keep_old' | 'both_valid',
    resolvedAt: new Date().toISOString(),
  });

  return JSON.stringify({ success: true, id: input.id, action: input.action, status });
}
