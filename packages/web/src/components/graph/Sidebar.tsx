import { X, FileText, GitFork } from 'lucide-react';
import type { ClusterNode } from './ClusterEngine';
import type { Relationship } from '../../stores/api';
import { useEffect, useState } from 'react';
import { api } from '../../stores/api';

interface Props {
  node: ClusterNode;
  onClose: () => void;
}

export function GraphSidebar({ node, onClose }: Props) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);

  useEffect(() => {
    if (node.type === 'entity') {
      api.getEntityRelationships(node.id).then((res) => {
        setRelationships(res.data);
      }).catch(() => {
        // ignore
      });
    }
  }, [node.id, node.type]);

  return (
    <div className="absolute right-0 top-0 h-full w-80 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-4 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">
          {node.type === 'cluster' ? 'Cluster' : 'Entity'} Details
        </h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <p className="text-xs text-zinc-500">Name</p>
          <p className="text-sm font-medium text-zinc-200">{node.label}</p>
        </div>

        {/* Type */}
        <div>
          <p className="text-xs text-zinc-500">Type</p>
          <p className="text-sm text-zinc-300">{node.entityType}</p>
        </div>

        {/* Confidence */}
        <div>
          <p className="text-xs text-zinc-500">Confidence</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 rounded-full bg-zinc-800">
              <div
                className="h-1.5 rounded-full bg-cortex-500"
                style={{ width: `${node.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400">
              {(node.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Source file */}
        {node.sourceFile && (
          <div>
            <p className="text-xs text-zinc-500">Source</p>
            <p className="flex items-center gap-1.5 text-xs text-zinc-400">
              <FileText className="h-3 w-3" />
              {node.sourceFile.split('/').slice(-2).join('/')}
            </p>
          </div>
        )}

        {/* Cluster children */}
        {node.type === 'cluster' && node.children && (
          <div>
            <p className="mb-2 text-xs text-zinc-500">
              Members ({node.children.length})
            </p>
            <div className="max-h-[60vh] space-y-1 overflow-y-auto">
              {node.children.slice(0, 50).map((child) => (
                <div
                  key={child.id}
                  className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300"
                >
                  {child.name}
                </div>
              ))}
              {node.children.length > 50 && (
                <p className="text-xs text-zinc-600">
                  ...and {node.children.length - 50} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Relationships */}
        {node.type === 'entity' && relationships.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-zinc-500">
              <GitFork className="h-3 w-3" />
              Relationships ({relationships.length})
            </p>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {relationships.map((rel) => (
                <div
                  key={rel.id}
                  className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs"
                >
                  <span className="text-cortex-400">{rel.type}</span>
                  <span className="text-zinc-500">
                    {' → '}
                    {rel.sourceEntityId === node.id
                      ? rel.targetEntityId.slice(0, 8)
                      : rel.sourceEntityId.slice(0, 8)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
