import { useRef, useCallback, useState, useEffect } from 'react';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { useForceGraph } from './useForceGraph';
import type { ClusterNode, ClusterEdge } from './ClusterEngine';

const TYPE_COLORS: Record<string, string> = {
  Decision: '#f59e0b',
  Requirement: '#3b82f6',
  Pattern: '#8b5cf6',
  Component: '#10b981',
  Dependency: '#ef4444',
  Interface: '#06b6d4',
  Constraint: '#f97316',
  ActionItem: '#ec4899',
  Risk: '#dc2626',
  Note: '#6b7280',
};

interface Props {
  nodes: ClusterNode[];
  edges: ClusterEdge[];
  width: number;
  height: number;
  onNodeClick?: (node: ClusterNode) => void;
  onNodeDoubleClick?: (node: ClusterNode) => void;
}

export function ForceGraph({
  nodes,
  edges,
  width,
  height,
  onNodeClick,
  onNodeDoubleClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [, forceRender] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const dragRef = useRef<{ node: ClusterNode; startX: number; startY: number } | null>(null);
  const zoomRef = useRef<ReturnType<typeof d3Zoom<SVGSVGElement, unknown>> | null>(null);
  const fittedRef = useRef(false);
  const tickCountRef = useRef(0);

  const fitBounds = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || nodes.length === 0) return;

    const positioned = nodes.filter(n => n.x != null && n.y != null);
    if (positioned.length === 0) return;

    // Calculate bounding box with padding based on node radii
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of positioned) {
      const r = n.type === 'cluster' ? 20 + Math.sqrt(n.count) * 4 : 10;
      const pad = r + 20;
      minX = Math.min(minX, n.x! - pad);
      maxX = Math.max(maxX, n.x! + pad);
      minY = Math.min(minY, n.y! - pad);
      maxY = Math.max(maxY, n.y! + pad);
    }

    const graphW = maxX - minX;
    const graphH = maxY - minY;
    if (graphW <= 0 || graphH <= 0) return;

    // The filter panel overlays ~220px on the left.
    // Center the graph in the remaining visible area.
    const filterPanelWidth = 220;
    const visibleLeft = filterPanelWidth;
    const visibleCenterX = visibleLeft + (width - visibleLeft) / 2;
    const visibleCenterY = height / 2;

    const scale = Math.min(
      (width - filterPanelWidth) / graphW,
      height / graphH,
    ) * 0.85;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const svgEl = select(svgRef.current);
    svgEl.call(
      zoomRef.current.transform,
      zoomIdentity
        .translate(visibleCenterX, visibleCenterY)
        .scale(scale)
        .translate(-cx, -cy),
    );
  }, [nodes, width, height]);

  const onTick = useCallback(() => {
    tickCountRef.current++;
    forceRender((n) => n + 1);

    // Fit at tick 100 as an early preview (gives forces time to spread)
    if (!fittedRef.current && tickCountRef.current === 100) {
      fittedRef.current = true;
      fitBounds();
    }
  }, [fitBounds]);

  const onSettled = useCallback(() => {
    // Final fit when simulation fully settles
    fitBounds();
  }, [fitBounds]);

  useForceGraph({ nodes, edges, width, height, onTick, onSettled });

  // Reset fit tracking when nodes change
  useEffect(() => {
    fittedRef.current = false;
    tickCountRef.current = 0;
  }, [nodes]);

  // Set up zoom
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svgEl = select(svgRef.current);
    const gEl = gRef.current;

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 6])
      .on('zoom', (event) => {
        const t = event.transform as { x: number; y: number; k: number };
        gEl.setAttribute('transform', `translate(${t.x},${t.y}) scale(${t.k})`);
      });

    zoomRef.current = zoomBehavior;
    svgEl.call(zoomBehavior);

    return () => {
      svgEl.on('.zoom', null);
    };
  }, [width, height]);

  const handleMouseDown = (e: React.MouseEvent, node: ClusterNode) => {
    e.stopPropagation();
    dragRef.current = { node, startX: e.clientX, startY: e.clientY };
    node.fx = node.x;
    node.fy = node.y;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const { node } = dragRef.current;
    // Get the current transform scale from gRef
    const gEl = gRef.current;
    const transform = gEl?.getAttribute('transform') ?? '';
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]!) : 1;

    node.fx = (node.fx ?? 0) + (e.movementX / scale);
    node.fy = (node.fy ?? 0) + (e.movementY / scale);
    forceRender((n) => n + 1);
  };

  const handleMouseUp = () => {
    if (dragRef.current) {
      const { node } = dragRef.current;
      node.fx = null;
      node.fy = null;
      dragRef.current = null;
    }
  };

  const handleNodeClick = (e: React.MouseEvent, node: ClusterNode) => {
    e.stopPropagation();
    onNodeClick?.(node);
  };

  const getNodeRadius = (node: ClusterNode) => {
    if (node.type === 'cluster') {
      return 20 + Math.sqrt(node.count) * 4;
    }
    return 6 + node.confidence * 4;
  };

  const getNodeColor = (node: ClusterNode) => {
    return TYPE_COLORS[node.entityType] ?? '#6b7280';
  };

  // Find connected node IDs for highlighting
  const connectedToHovered = new Set<string>();
  if (hoveredNode) {
    for (const edge of edges) {
      const src = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const tgt = typeof edge.target === 'string' ? edge.target : edge.target.id;
      if (src === hoveredNode) connectedToHovered.add(tgt);
      if (tgt === hoveredNode) connectedToHovered.add(src);
    }
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="cursor-grab active:cursor-grabbing"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (dragRef.current) {
          dragRef.current.node.fx = null;
          dragRef.current.node.fy = null;
          dragRef.current = null;
        }
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 7"
          refX="10"
          refY="3.5"
          markerWidth="8"
          markerHeight="6"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#52525b" />
        </marker>
        <marker
          id="arrowhead-active"
          viewBox="0 0 10 7"
          refX="10"
          refY="3.5"
          markerWidth="8"
          markerHeight="6"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#0ea5e9" />
        </marker>
      </defs>

      <g ref={gRef}>
        {/* Edges */}
        {edges.map((edge) => {
          const src = edge.source as ClusterNode;
          const tgt = edge.target as ClusterNode;
          if (src.x == null || tgt.x == null) return null;

          const srcId = typeof edge.source === 'string' ? edge.source : src.id;
          const tgtId = typeof edge.target === 'string' ? edge.target : tgt.id;
          const isHighlighted =
            hoveredNode != null &&
            (srcId === hoveredNode || tgtId === hoveredNode);

          const srcR = getNodeRadius(src);
          const tgtR = getNodeRadius(tgt);
          const dx = (tgt.x ?? 0) - (src.x ?? 0);
          const dy = (tgt.y ?? 0) - (src.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const sx = (src.x ?? 0) + (dx / dist) * srcR;
          const sy = (src.y ?? 0) + (dy / dist) * srcR;
          const tx = (tgt.x ?? 0) - (dx / dist) * (tgtR + 8);
          const ty = (tgt.y ?? 0) - (dy / dist) * (tgtR + 8);

          return (
            <line
              key={edge.id}
              x1={sx}
              y1={sy}
              x2={tx}
              y2={ty}
              stroke={isHighlighted ? '#0ea5e9' : '#3f3f46'}
              strokeWidth={isHighlighted ? 1.5 : Math.min(1 + (edge.weight ?? 1) * 0.3, 3)}
              opacity={hoveredNode && !isHighlighted ? 0.15 : 0.6}
              markerEnd={isHighlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          if (node.x == null || node.y == null) return null;
          const r = getNodeRadius(node);
          const color = getNodeColor(node);
          const isHovered = hoveredNode === node.id;
          const isConnected = connectedToHovered.has(node.id);
          const dimmed = hoveredNode != null && !isHovered && !isConnected;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={(e) => handleNodeClick(e, node)}
              onMouseDown={(e) => handleMouseDown(e, node)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onDoubleClick={() => onNodeDoubleClick?.(node)}
              className="cursor-pointer"
              opacity={dimmed ? 0.2 : 1}
            >
              {/* Glow on hover */}
              {isHovered && (
                <circle r={r + 4} fill={color} opacity={0.2} />
              )}
              <circle
                r={r}
                fill={node.type === 'cluster' ? `${color}33` : `${color}88`}
                stroke={color}
                strokeWidth={node.type === 'cluster' ? 2 : 1.5}
              />
              {/* Cluster count badge */}
              {node.type === 'cluster' && (
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#e4e4e7"
                  fontSize={10}
                  fontWeight="bold"
                >
                  {node.count}
                </text>
              )}
              {/* Label */}
              <text
                y={r + 12}
                textAnchor="middle"
                fill="#a1a1aa"
                fontSize={node.type === 'cluster' ? 11 : 9}
                fontWeight={node.type === 'cluster' ? 600 : 400}
              >
                {truncateLabel(node.label, node.type === 'cluster' ? 30 : 20)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function truncateLabel(label: string, max: number): string {
  return label.length > max ? label.slice(0, max - 1) + '\u2026' : label;
}
