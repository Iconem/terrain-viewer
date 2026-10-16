import { useState } from 'react';
import type { Data, PathStep } from './model';
import { ancestors } from './model';

export function Sitemap({ data, selected, path, onSelect }: {
  data: Data; selected: string | null; path: PathStep[]; onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const stepOf = Object.fromEntries(path.filter((s) => s.node).map((s) => [s.node!, s.n]));
  const open = new Set(selected ? ancestors(data.nodes, selected) : []);
  const q = query.trim().toLowerCase();
  const matches = (id: string): boolean => {
    const n = data.nodes[id];
    return !q || n.label.toLowerCase().includes(q) || n.id.includes(q) || n.children.some(matches);
  };

  const Item = ({ id, depth }: { id: string; depth: number }) => {
    const n = data.nodes[id];
    if (!matches(id)) return null;
    const isGroup = n.children.length > 0;
    const isOpen = q ? true : !closed.has(id) && (open.has(id) || depth === 0 || n.kind === 'group');
    const holdsSelection = !isOpen && selected && ancestors(data.nodes, selected).includes(id);
    return (
      <li role="treeitem" aria-expanded={isGroup ? isOpen : undefined} aria-selected={selected === id}>
        <div className={`row ${selected === id ? 'selected' : ''} kind-${n.kind}`} style={{ paddingLeft: 8 + depth * 14 }}>
          {isGroup ? (
            <button className="chev" aria-label={isOpen ? 'Collapse' : 'Expand'} onClick={() => setClosed((c) => { const s = new Set(c); s.has(id) ? s.delete(id) : s.add(id); return s; })}>
              {isOpen ? '▾' : '▸'}
            </button>
          ) : <span className="chev" />}
          <button className="label" onClick={() => onSelect(id)} title={n.how || n.summary || n.label}>
            {n.label}
            {holdsSelection && <span className="muted"> · holds selection</span>}
          </button>
          {stepOf[id] && <span className="step-badge" title={`Step ${stepOf[id]} of the playing flow`}>{stepOf[id]}</span>}
          {n.evidence === 'Not captured' && <span className="dot warn" title="Not captured" />}
          {n.evidence === 'Specified' && <span className="dot spec" title="Specified, no screenshot yet" />}
          {isGroup && !stepOf[id] && <span className="count">{n.children.length}</span>}
        </div>
        {isGroup && isOpen && <ul role="group">{n.children.map((c) => <Item key={c} id={c} depth={depth + 1} />)}</ul>}
      </li>
    );
  };

  return (
    <aside className="sitemap">
      <div className="pane-head">
        <span>SITEMAP</span>
        <input type="search" placeholder="Search screens" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search screens" />
      </div>
      <ul role="tree" aria-label="Sitemap">
        {data.products.map((p) => <Item key={p.id} id={p.root} depth={0} />)}
      </ul>
      <div className="legend">
        <span><span className="step-badge">1</span> step on the playing flow</span>
        <span><span className="dot spec" /> specified, not captured</span>
      </div>
    </aside>
  );
}
