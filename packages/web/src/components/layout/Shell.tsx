import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Shell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-950 p-6">
        <Outlet />
      </main>
    </div>
  );
}
