import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../../stores/api';
import {
  LayoutDashboard,
  Network,
  Radio,
  Search,
  AlertTriangle,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/graph', icon: Network, label: 'Knowledge Graph' },
  { to: '/feed', icon: Radio, label: 'Live Feed' },
  { to: '/query', icon: Search, label: 'Query Explorer' },
  { to: '/contradictions', icon: AlertTriangle, label: 'Contradictions' },
] as const;

export function Sidebar() {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    api.getStatus().then((res) => setVersion(res.data.version ?? '')).catch(() => {});
  }, []);

  return (
    <aside className="flex h-full w-56 flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Logo */}
      <div className="flex items-center border-b border-zinc-800 px-5 py-4">
        <img src="/logo.png" alt="GZOO Cortex" className="h-7" />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-cortex-500/10 text-cortex-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Status footer */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Connected
          </div>
          {version && <span className="text-zinc-600">v{version}</span>}
        </div>
      </div>
    </aside>
  );
}
