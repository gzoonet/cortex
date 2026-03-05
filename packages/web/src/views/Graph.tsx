import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { api } from '../stores/api';
import { ForceGraph } from '../components/graph/ForceGraph';
import { GraphFilters } from '../components/graph/Filters';
import { GraphSidebar } from '../components/graph/Sidebar';
import {
  type GraphNode,
  type GraphEdge,
  type ClusterNode,
  type ClusterEdge,
  type ClusterMode,
  detectClusterMode,
  clusterByType,
  clusterByTypeAndDir,
  expandCluster,
} from '../components/graph/ClusterEngine';

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function Graph() {
  const [rawData, setRawData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set([
      'Decision', 'Requirement', 'Pattern', 'Component', 'Dependency',
      'Interface', 'Constraint', 'ActionItem', 'Risk', 'Note',
    ]),
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState(0);

  // Sidebar
  const [selectedNode, setSelectedNode] = useState<ClusterNode | null>(null);

  // Container size
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Expanded clusters
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getStatus()
      .then(() =>
        fetch('/api/v1/graph?limit=2000')
          .then((r) => r.json() as Promise<{ success: boolean; data: GraphData }>)
          .then((r) => {
            if (r.success) setRawData(r.data);
            else setError('Failed to load graph data');
            setLoading(false);
          }),
      )
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Apply filters to raw data
  const filteredData = useMemo(() => {
    if (!rawData) return null;

    const nodes = rawData.nodes.filter((n) => {
      if (!activeTypes.has(n.type)) return false;
      if (n.confidence < confidenceThreshold) return false;
      if (search && !n.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = rawData.edges.filter(
      (e) => nodeIds.has(e.source as string) && nodeIds.has(e.target as string),
    );

    return { nodes, edges };
  }, [rawData, activeTypes, confidenceThreshold, search]);

  // Apply clustering
  const { displayNodes, displayEdges, clusterMode } = useMemo(() => {
    if (!filteredData) return { displayNodes: [], displayEdges: [], clusterMode: 'none' as ClusterMode };

    const mode = detectClusterMode(filteredData.nodes.length);

    if (mode === 'none') {
      // Direct rendering — convert GraphNode to ClusterNode
      const nodes: ClusterNode[] = filteredData.nodes.map((n) => ({
        id: n.id,
        label: n.name,
        type: 'entity' as const,
        entityType: n.type,
        count: 1,
        confidence: n.confidence,
        sourceFile: n.sourceFile,
      }));
      const edges: ClusterEdge[] = filteredData.edges.map((e) => ({
        id: e.id,
        source: typeof e.source === 'string' ? e.source : e.source.id,
        target: typeof e.target === 'string' ? e.target : e.target.id,
        type: e.type,
        weight: 1,
      }));
      return { displayNodes: nodes, displayEdges: edges, clusterMode: mode };
    }

    if (mode === 'type') {
      const { nodes, edges } = clusterByType(filteredData.nodes, filteredData.edges);
      return { displayNodes: nodes, displayEdges: edges, clusterMode: mode };
    }

    // type-dir
    const { nodes, edges } = clusterByTypeAndDir(filteredData.nodes, filteredData.edges);
    return { displayNodes: nodes, displayEdges: edges, clusterMode: mode };
  }, [filteredData]);

  // Handle expand with memoized state
  const [currentNodes, setCurrentNodes] = useState<ClusterNode[]>([]);
  const [currentEdges, setCurrentEdges] = useState<ClusterEdge[]>([]);

  useEffect(() => {
    setCurrentNodes(displayNodes);
    setCurrentEdges(displayEdges);
    setExpandedClusters(new Set());
  }, [displayNodes, displayEdges]);

  const handleNodeClick = useCallback((node: ClusterNode) => {
    setSelectedNode(node);
  }, []);

  const handleNodeDoubleClick = useCallback(
    (node: ClusterNode) => {
      if (node.type !== 'cluster' || !node.children || !filteredData) return;
      if (expandedClusters.has(node.id)) return;

      const { nodes, edges } = expandCluster(node, currentNodes, filteredData.edges);
      setCurrentNodes(nodes);
      setCurrentEdges(edges);
      setExpandedClusters((prev) => new Set(prev).add(node.id));
    },
    [currentNodes, filteredData, expandedClusters],
  );

  const handleTypeToggle = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // Always render the container so containerRef is attached for ResizeObserver
  return (
    <div className="relative h-full" ref={containerRef}>
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cortex-500 border-t-transparent" />
            Loading graph...
          </div>
        </div>
      ) : error ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-red-400">{error}</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <GraphFilters
            search={search}
            onSearchChange={setSearch}
            activeTypes={activeTypes}
            onTypeToggle={handleTypeToggle}
            confidenceThreshold={confidenceThreshold}
            onConfidenceChange={setConfidenceThreshold}
            nodeCount={currentNodes.length}
            edgeCount={currentEdges.length}
            clusterMode={clusterMode}
          />

          {/* Graph */}
          <ForceGraph
            nodes={currentNodes}
            edges={currentEdges}
            width={dimensions.width - (selectedNode ? 320 : 0)}
            height={dimensions.height}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
          />

          {/* Sidebar */}
          {selectedNode && (
            <GraphSidebar
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          )}

          {/* Help hint */}
          {clusterMode !== 'none' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-zinc-800/80 px-4 py-2 text-xs text-zinc-400 backdrop-blur">
              Double-click a cluster to expand it • Click a node for details • Scroll to zoom
            </div>
          )}
        </>
      )}
    </div>
  );
}
