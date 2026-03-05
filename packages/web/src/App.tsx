import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { Dashboard } from './views/Dashboard';
import { Graph } from './views/Graph';
import { LiveFeed } from './views/LiveFeed';
import { Query } from './views/Query';
import { Contradictions } from './views/Contradictions';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="graph" element={<Graph />} />
          <Route path="feed" element={<LiveFeed />} />
          <Route path="query" element={<Query />} />
          <Route path="contradictions" element={<Contradictions />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
