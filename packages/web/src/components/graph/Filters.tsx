import { Search } from 'lucide-react';

const ENTITY_TYPES = [
  'Decision', 'Requirement', 'Pattern', 'Component', 'Dependency',
  'Interface', 'Constraint', 'ActionItem', 'Risk', 'Note',
];

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
  search: string;
  onSearchChange: (value: string) => void;
  activeTypes: Set<string>;
  onTypeToggle: (type: string) => void;
  confidenceThreshold: number;
  onConfidenceChange: (value: number) => void;
  nodeCount: number;
  edgeCount: number;
  clusterMode: string;
}

export function GraphFilters({
  search,
  onSearchChange,
  activeTypes,
  onTypeToggle,
  confidenceThreshold,
  onConfidenceChange,
  nodeCount,
  edgeCount,
  clusterMode,
}: Props) {
  return (
    <div className="absolute left-4 top-4 z-10 w-60 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/95 p-3 shadow-xl backdrop-blur">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search nodes..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-cortex-500"
        />
      </div>

      {/* Type checkboxes */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Types
        </p>
        <div className="grid grid-cols-2 gap-1">
          {ENTITY_TYPES.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-xs hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={activeTypes.has(type)}
                onChange={() => onTypeToggle(type)}
                className="sr-only"
              />
              <span
                className="h-2.5 w-2.5 rounded-sm border"
                style={{
                  backgroundColor: activeTypes.has(type)
                    ? TYPE_COLORS[type]
                    : 'transparent',
                  borderColor: TYPE_COLORS[type] ?? '#6b7280',
                }}
              />
              <span
                className={
                  activeTypes.has(type) ? 'text-zinc-300' : 'text-zinc-600'
                }
              >
                {type.length > 10 ? type.slice(0, 8) + '..' : type}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Confidence slider */}
      <div>
        <div className="mb-1 flex justify-between text-[10px]">
          <span className="font-semibold uppercase tracking-wider text-zinc-500">
            Min Confidence
          </span>
          <span className="text-zinc-400">{(confidenceThreshold * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={confidenceThreshold * 100}
          onChange={(e) => onConfidenceChange(Number(e.target.value) / 100)}
          className="w-full accent-cortex-500"
        />
      </div>

      {/* Stats */}
      <div className="flex justify-between border-t border-zinc-800 pt-2 text-[10px] text-zinc-500">
        <span>{nodeCount} nodes</span>
        <span>{edgeCount} edges</span>
        <span>{clusterMode}</span>
      </div>
    </div>
  );
}
