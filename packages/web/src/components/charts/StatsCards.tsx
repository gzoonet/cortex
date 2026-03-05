import { Network, GitFork, AlertTriangle, FileText } from 'lucide-react';
import type { StatusData } from '../../stores/api';

const STATS_CONFIG = [
  { key: 'entityCount' as const, label: 'Entities', icon: Network, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  { key: 'relationshipCount' as const, label: 'Relationships', icon: GitFork, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { key: 'contradictionCount' as const, label: 'Contradictions', icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { key: 'fileCount' as const, label: 'Files', icon: FileText, color: 'text-violet-400', bg: 'bg-violet-500/10' },
];

interface Props {
  graph: StatusData['graph'];
}

export function StatsCards({ graph }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {STATS_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
        <div
          key={key}
          className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
        >
          <div className={`rounded-lg ${bg} p-2.5`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>
              {graph[key].toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
