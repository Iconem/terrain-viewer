import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import type { Data, Flow, PathStep } from './model';
import { Badge } from './Stage';

mermaid.initialize({
  startOnLoad: false, securityLevel: 'loose', theme: 'base', fontFamily: 'system-ui, sans-serif',
  flowchart: { htmlLabels: false, curve: 'basis', nodeSpacing: 36, rankSpacing: 48, useMaxWidth: false },
  themeVariables: { primaryColor: '#ffffff', primaryBorderColor: '#5b6b7f', primaryTextColor: '#1a2230', lineColor: '#5b6b7f', fontSize: '14px' },
});

/** Renders the flow's Mermaid source, then wires it: boxes open their screen, the current path gets a halo, step numbers and blue arrows. */
export function FlowsView({ data, flow, path, selectedNode, onPick, onPlay, onOpenNode }: {
  data: Data; flow: Flow; path: PathStep[]; selectedNode: string | null;
  onPick: (id: string) => void; onPlay: (id: string) => void; onOpenNode: (id: string, step?: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');
  const [err, setErr] = useState('');
  const [hover, setHover] = useState<{ node: string; x: number; y: number; flip: boolean } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const id = `m-${flow.id}-${++seq.current}`;
    mermaid.render(id, flow.mermaid).then(({ svg }) => { setSvg(svg); setErr(''); }).catch((e) => setErr(String(e)));
  }, [flow]);

  useEffect(() => {
    const root = host.current?.querySelector('svg');
    if (!root) return;
    root.style.maxWidth = '100%'; root.style.height = 'auto';
    const onPath = new Map(path.map((s) => [s.mid, s]));
    // Nodes: Mermaid ids them `<renderId>-flowchart-<mid>-<n>`.
    root.querySelectorAll<SVGGElement>('g.node').forEach((g) => {
      const mid = (g.id.match(/flowchart-(.+)-\d+$/) || [])[1];
      if (!mid) return;
      const step = flow.steps.find((s) => s.mid === mid);
      const ps = onPath.get(mid);
      g.classList.toggle('on-path', !!ps);
      g.classList.toggle('selected', !!step?.node && step.node === selectedNode);
      g.classList.toggle('decision', step?.kind === 'decision');
      g.classList.toggle('no-shot', !!step?.node && !data.nodes[step.node]?.screens?.length);
      g.style.cursor = step?.node ? 'pointer' : 'default';
      g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0');
      const open = () => { if (step?.node) onOpenNode(step.node, ps?.n); else if (ps) onOpenNode(selectedNode ?? '', ps.n); };
      g.onclick = open;
      g.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
      // Hover preview: the screen's thumbnail beside the box, inside the diagram's own box.
      g.onmouseenter = g.onfocus = () => {
        if (!step?.node || !host.current) return;
        const hr = host.current.getBoundingClientRect(), br = g.getBoundingClientRect();
        const flip = br.right + 290 > hr.right;
        setHover({ node: step.node, x: (flip ? br.left - 290 : br.right + 12) - hr.left + host.current.scrollLeft, y: br.top - hr.top + host.current.scrollTop - 8, flip });
      };
      g.onmouseleave = g.onblur = () => setHover(null);
      g.querySelector('.step-tag')?.remove();
      if (ps) {
        const shape = g.querySelector<SVGGraphicsElement>('rect, polygon, path');
        const b = shape?.getBBox();
        if (b) {
          const tag = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          tag.setAttribute('class', 'step-tag');
          const isDiamond = step?.kind === 'decision';
          const cx = isDiamond ? b.x + b.width * 0.25 : b.x, cy = isDiamond ? b.y + b.height * 0.25 : b.y;
          // Inline styles: Mermaid's own stylesheet is scoped to the svg id and would outrank a class rule.
          tag.innerHTML = `<circle cx="${cx}" cy="${cy}" r="10" style="fill:#3b82f6 !important;stroke:#fff !important;stroke-width:2px"/>`
            + `<text x="${cx}" y="${cy + 4}" text-anchor="middle" style="fill:#fff !important;font-size:11px;font-weight:700">${ps.n}</text>`;
          g.appendChild(tag);
        }
      }
    });
    // Edges: `<renderId>-L_<from>_<to>_<n>` (v11) or `L-<from>-<to>-<n>` (v10). The chosen arrow out of each path step is lit.
    const chosen = path.filter((s) => s.chosen).map((s) => [s.mid, s.chosen!.to]);
    root.querySelectorAll<SVGPathElement>('path.flowchart-link, .edgePath path').forEach((p) => {
      const lit = chosen.some(([f, t]) => p.id.includes(`L_${f}_${t}_`) || p.id.includes(`L-${f}-${t}-`));
      p.classList.toggle('on-path', lit);
    });
  }, [svg, path, selectedNode, flow, data, onOpenNode]);

  return (
    <main className="flows">
      <aside className="flow-list">
        <h1>User flows</h1>
        <p className="muted">Each flow follows one reviewer task. Select a box in the diagram to open its screen in the map.</p>
        {data.flows.map((f) => (
          <button key={f.id} className={`flow-card ${f.id === flow.id ? 'on' : ''}`} onClick={() => onPick(f.id)}>
            <b>{f.id}</b> {f.title}<br /><span className="muted">{f.evidence} · {f.steps.filter((s) => s.node).length} screens</span>
          </button>
        ))}
      </aside>
      <section className="flow-detail">
        <div className="stage-head">
          <h1>{flow.id} · {flow.title}</h1>
          <Badge text={flow.evidence} />
          <span className="spacer" />
          <button className="primary" onClick={() => onPlay(flow.id)}>▶ Play in the map</button>
        </div>
        <p className="lede">{flow.intro}</p>
        <div className="key">
          <span><i className="k-screen" /> Screen</span><span><i className="k-decision" /> Decision</span>
          <span><i className="k-main" /> Main route</span><span><i className="k-alt" /> Alternative</span><span><i className="k-opt" /> Optional or way back</span>
          <span><i className="k-path" /> Selected path</span><span className="step-badge">1</span> Step number
        </div>
        {err && <pre className="error">{err}</pre>}
        <div className="diagram-wrap">
          <div className="diagram" ref={host} dangerouslySetInnerHTML={{ __html: svg }} />
          {hover && (() => {
            const n = data.nodes[hover.node]; const shot = n.screens?.[0];
            return (
              <div className="hover-card" style={{ left: hover.x, top: hover.y }}>
                {shot ? <img src={shot.src} alt="" /> : <div className="noshot">No screenshot yet</div>}
                <b>{n.label}</b>
                {n.how && <span className="muted small">{n.how}</span>}
              </div>
            );
          })()}
        </div>
        <h2>Path</h2>
        <ol className="path">
          {path.map((s) => (
            <li key={s.mid}>
              <button className="link" onClick={() => s.node ? onOpenNode(s.node, s.n) : onOpenNode(selectedNode ?? '', s.n)}>{s.label}</button>
              {s.options.length > 1 && <span className="muted"> · branch: {s.options.map((o) => o.label || o.to).join(' / ')} → <b>{s.chosen?.label || s.chosen?.to || 'stop'}</b></span>}
              {s.chosen?.weight === 'optional' && <span className="muted"> (way back)</span>}
            </li>
          ))}
        </ol>
        <p className="muted">Source: <code>{flow.source}</code>. Edit the Mermaid there and run <code>npm run data</code>.</p>
      </section>
    </main>
  );
}
