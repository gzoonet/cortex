const API_BASE = '/api/v1';

const TOKEN_STORAGE_KEY = 'cortex-auth-token';

function getAuthToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  // The server only embeds the token for an authenticated document load
  // (e.g. opening the dashboard with ?token=...). Persist it for this tab so a
  // plain refresh keeps working, while anonymous loads still receive no token.
  const win = window as typeof window & { __CORTEX_TOKEN__?: string };
  const injected =
    win.__CORTEX_TOKEN__ ??
    document.querySelector('meta[name="cortex-auth-token"]')?.getAttribute('content') ??
    undefined;
  if (injected) {
    try { sessionStorage.setItem(TOKEN_STORAGE_KEY, injected); } catch { /* storage unavailable */ }
    return injected;
  }

  try { return sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? undefined; } catch { return undefined; }
}

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: authHeaders(options?.headers as Record<string, string> | undefined),
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    throw new Error(json.error?.message ?? 'API request failed');
  }
  return json;
}

// Typed convenience functions
export const api = {
  getStatus: () => apiFetch<StatusData>('/status'),
  getReport: () => apiFetch<ReportData>('/report'),
  getProjects: () => apiFetch<Project[]>('/projects'),
  getEntities: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<Entity[]>(`/entities${qs}`);
  },
  getEntity: (id: string) => apiFetch<Entity>(`/entities/${id}`),
  getEntityRelationships: (id: string, direction = 'both') =>
    apiFetch<Relationship[]>(`/entities/${id}/relationships?direction=${direction}`),
  getContradictions: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<Contradiction[]>(`/contradictions${qs}`);
  },
  resolveContradiction: (id: string, action: string) =>
    apiFetch<{ id: string; status: string; action: string }>(
      `/contradictions/${id}/resolve`,
      { method: 'POST', body: JSON.stringify({ action }) },
    ),
  query: (query: string, projectId?: string) =>
    apiFetch<QueryResult>('/query', {
      method: 'POST',
      body: JSON.stringify({ query, projectId }),
    }),

  queryStream: async function* (
    query: string,
    projectId?: string,
  ): AsyncGenerator<{ type: 'chunk'; content: string } | { type: 'sources'; entities: QueryResult['sources'] } | { type: 'complete' }> {
    const res = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: JSON.stringify({ query, projectId, stream: true }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Query failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            yield JSON.parse(line.slice(6));
          } catch {
            // skip malformed SSE
          }
        }
      }
    }
  },
};

// Types matching API responses
export interface StatusData {
  version?: string;
  graph: {
    entityCount: number;
    relationshipCount: number;
    fileCount: number;
    projectCount: number;
    contradictionCount: number;
    dbSizeBytes: number;
  };
  llm: {
    mode: string;
    available: boolean;
  };
}

export interface ReportData {
  generatedAt: string;
  fileStatus: { ingested: number; failed: number; skipped: number; pending: number };
  entityBreakdown: Array<{ type: string; count: number; avgConfidence: number }>;
  relationshipBreakdown: Array<{ type: string; count: number }>;
  contradictions: {
    active: number;
    resolved: number;
    dismissed: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
  };
  tokenEstimate: { totalInput: number; totalOutput: number };
  supersededCount: number;
  failedFiles: Array<{ relativePath: string; parseError: string }>;
  topContradictions: Array<{
    id: string;
    severity: string;
    entityA: string;
    entityB: string;
    description: string;
  }>;
}

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  entityCount: number;
  fileCount: number;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  summary: string;
  confidence: number;
  projectId: string;
  sourceFile: string;
  status: string;
  createdAt: string;
}

export interface Relationship {
  id: string;
  type: string;
  sourceEntityId: string;
  targetEntityId: string;
  confidence: number;
  description?: string;
}

export interface Contradiction {
  id: string;
  entityIds: [string, string];
  description: string;
  severity: string;
  status: string;
  entityA?: { id: string; name: string; type: string; summary: string } | null;
  entityB?: { id: string; name: string; type: string; summary: string } | null;
}

export interface QueryResult {
  answer: string;
  sources: Array<{ id?: string; name: string; type: string; content?: string; summary?: string }>;
  relationships?: Array<{ type: string; sourceEntityId: string; targetEntityId: string; description?: string }>;
  model?: string;
  tokens?: { input: number; output: number };
}
