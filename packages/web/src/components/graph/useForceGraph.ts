import { useRef, useEffect, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import type { ClusterNode, ClusterEdge } from './ClusterEngine';

interface UseForceGraphOptions {
  nodes: ClusterNode[];
  edges: ClusterEdge[];
  width: number;
  height: number;
  onTick: () => void;
  onSettled?: () => void;
}

export function useForceGraph({ nodes, edges, width, height, onTick, onSettled }: UseForceGraphOptions) {
  const simRef = useRef<Simulation<SimulationNodeDatum, SimulationLinkDatum<SimulationNodeDatum>> | null>(null);

  const restart = useCallback(() => {
    if (simRef.current) {
      simRef.current.stop();
    }

    const sim = forceSimulation(nodes as unknown as SimulationNodeDatum[])
      .force(
        'link',
        forceLink(edges as unknown as SimulationLinkDatum<SimulationNodeDatum>[])
          .id((d) => (d as ClusterNode).id)
          .distance((d) => {
            const link = d as unknown as ClusterEdge;
            const weight = typeof link.weight === 'number' ? link.weight : 1;
            return 150 + 60 / Math.sqrt(weight);
          })
          .strength(0.4),
      )
      .force('charge', forceManyBody().strength((d) => {
        const node = d as unknown as ClusterNode;
        if (node.type === 'cluster') {
          return -500 - Math.min(Math.sqrt(node.count) * 60, 2000);
        }
        return -250;
      }))
      // Use forceX/Y instead of forceCenter — pulls each node individually toward origin
      // fitBounds handles final viewport positioning after simulation settles
      .force('x', forceX(0).strength(0.07))
      .force('y', forceY(0).strength(0.07))
      .force('collide', forceCollide((d) => {
        const node = d as unknown as ClusterNode;
        return node.type === 'cluster' ? 35 + Math.sqrt(node.count) * 5 : 18;
      }).strength(0.9))
      .alphaDecay(0.03)
      .on('tick', onTick)
      .on('end', () => {
        onSettled?.();
      });

    simRef.current = sim;
  }, [nodes, edges, width, height, onTick, onSettled]);

  useEffect(() => {
    restart();
    return () => {
      simRef.current?.stop();
    };
  }, [restart]);

  return { simulation: simRef };
}
