/**
 * Smart clustering for large graphs:
 *  < 100 entities: render all nodes directly
 *  100-500: cluster by entity type, expand on click
 *  500+: cluster by type + source directory
 */

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  confidence: number;
  sourceFile: string;
  // D3 simulation props
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  confidence: number;
}

export interface ClusterNode {
  id: string;
  label: string;
  type: 'entity' | 'cluster';
  entityType: string;
  count: number;
  confidence: number;
  children?: GraphNode[];
  sourceFile?: string;
  // D3 simulation
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface ClusterEdge {
  id: string;
  source: string | ClusterNode;
  target: string | ClusterNode;
  type: string;
  weight: number;
}

export type ClusterMode = 'none' | 'type' | 'type-dir';

export function detectClusterMode(nodeCount: number): ClusterMode {
  if (nodeCount < 100) return 'none';
  if (nodeCount < 3000) return 'type';
  return 'type-dir';
}

function getDirectory(sourceFile: string): string {
  const parts = sourceFile.replace(/\\/g, '/').split('/');
  return parts.slice(0, -1).join('/') || '/';
}

export function clusterByType(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { nodes: ClusterNode[]; edges: ClusterEdge[] } {
  const groups = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    const group = groups.get(node.type) ?? [];
    group.push(node);
    groups.set(node.type, group);
  }

  const clusterNodes: ClusterNode[] = [];
  const nodeToCluster = new Map<string, string>();

  for (const [type, members] of groups) {
    const clusterId = `cluster:${type}`;
    const avgConf = members.reduce((s, m) => s + m.confidence, 0) / members.length;

    clusterNodes.push({
      id: clusterId,
      label: `${type} (${members.length})`,
      type: 'cluster',
      entityType: type,
      count: members.length,
      confidence: avgConf,
      children: members,
    });

    for (const m of members) {
      nodeToCluster.set(m.id, clusterId);
    }
  }

  return {
    nodes: clusterNodes,
    edges: aggregateEdges(edges, nodeToCluster),
  };
}

export function clusterByTypeAndDir(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { nodes: ClusterNode[]; edges: ClusterEdge[] } {
  const groups = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    const dir = getDirectory(node.sourceFile);
    const key = `${node.type}::${dir}`;
    const group = groups.get(key) ?? [];
    group.push(node);
    groups.set(key, group);
  }

  const clusterNodes: ClusterNode[] = [];
  const nodeToCluster = new Map<string, string>();

  for (const [key, members] of groups) {
    const [type, dir] = key.split('::');
    const clusterId = `cluster:${key}`;
    const avgConf = members.reduce((s, m) => s + m.confidence, 0) / members.length;
    const shortDir = dir!.split('/').slice(-2).join('/') || '/';

    clusterNodes.push({
      id: clusterId,
      label: `${type} - ${shortDir} (${members.length})`,
      type: 'cluster',
      entityType: type!,
      count: members.length,
      confidence: avgConf,
      children: members,
    });

    for (const m of members) {
      nodeToCluster.set(m.id, clusterId);
    }
  }

  return {
    nodes: clusterNodes,
    edges: aggregateEdges(edges, nodeToCluster),
  };
}

function aggregateEdges(
  edges: GraphEdge[],
  nodeToCluster: Map<string, string>,
): ClusterEdge[] {
  const edgeMap = new Map<string, ClusterEdge>();

  for (const edge of edges) {
    const srcId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const tgtId = typeof edge.target === 'string' ? edge.target : edge.target.id;
    const src = nodeToCluster.get(srcId) ?? srcId;
    const tgt = nodeToCluster.get(tgtId) ?? tgtId;

    if (src === tgt) continue; // skip intra-cluster edges

    const key = src < tgt ? `${src}|${tgt}` : `${tgt}|${src}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.weight++;
    } else {
      edgeMap.set(key, {
        id: `ce:${key}`,
        source: src,
        target: tgt,
        type: edge.type,
        weight: 1,
      });
    }
  }

  return Array.from(edgeMap.values());
}

export function expandCluster(
  cluster: ClusterNode,
  currentNodes: ClusterNode[],
  originalEdges: GraphEdge[],
): { nodes: ClusterNode[]; edges: ClusterEdge[] } {
  if (!cluster.children) return { nodes: currentNodes, edges: [] };

  // Replace cluster with its children
  const expanded: ClusterNode[] = currentNodes
    .filter((n) => n.id !== cluster.id)
    .concat(
      cluster.children.map((child) => ({
        id: child.id,
        label: child.name,
        type: 'entity' as const,
        entityType: child.type,
        count: 1,
        confidence: child.confidence,
        sourceFile: child.sourceFile,
        x: (cluster.x ?? 0) + (Math.random() - 0.5) * 80,
        y: (cluster.y ?? 0) + (Math.random() - 0.5) * 80,
      })),
    );

  // Rebuild edges
  const nodeIds = new Set(expanded.map((n) => n.id));
  const nodeToCluster = new Map<string, string>();
  for (const n of expanded) {
    if (n.type === 'cluster' && n.children) {
      for (const c of n.children) {
        nodeToCluster.set(c.id, n.id);
      }
    }
  }

  const edges: ClusterEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const edge of originalEdges) {
    const srcId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const tgtId = typeof edge.target === 'string' ? edge.target : edge.target.id;

    let src = nodeIds.has(srcId) ? srcId : nodeToCluster.get(srcId);
    let tgt = nodeIds.has(tgtId) ? tgtId : nodeToCluster.get(tgtId);

    if (!src || !tgt || src === tgt) continue;

    // For cluster edges, aggregate
    if (!nodeIds.has(src)) src = nodeToCluster.get(src);
    if (!nodeIds.has(tgt)) tgt = nodeToCluster.get(tgt);
    if (!src || !tgt || src === tgt) continue;

    const key = src < tgt ? `${src}|${tgt}` : `${tgt}|${src}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);

    edges.push({
      id: `e:${key}`,
      source: src,
      target: tgt,
      type: edge.type,
      weight: 1,
    });
  }

  return { nodes: expanded, edges };
}
