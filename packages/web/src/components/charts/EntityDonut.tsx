import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const ENTITY_COLORS: Record<string, string> = {
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
  data: Array<{ type: string; count: number }>;
}

export function EntityDonut({ data }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="flex items-center gap-6">
      <div className="h-48 w-48 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="type"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.type}
                  fill={ENTITY_COLORS[entry.type] ?? '#6b7280'}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              itemStyle={{ color: '#e4e4e7' }}
              formatter={(value: number) => [
                `${value} (${((value / total) * 100).toFixed(1)}%)`,
                '',
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {data.map((entry) => (
          <div key={entry.type} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ENTITY_COLORS[entry.type] ?? '#6b7280' }}
            />
            <span className="text-zinc-400">{entry.type}</span>
            <span className="font-medium text-zinc-300">{entry.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
