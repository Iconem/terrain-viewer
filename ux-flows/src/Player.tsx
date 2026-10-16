import { useEffect, useRef } from 'react';
import type { Data, Flow, PathStep } from './model';

export function Player({ data, flow, flows, path, step, onStep, nodeId, onGoTo, onChoose, onSetFlow, onClose }: {
  data: Data; flow: Flow; flows: Flow[]; path: PathStep[]; step: number; onStep: boolean; nodeId: string | null;
  onGoTo: (n: number) => void; onChoose: (atMid: string, toMid: string) => void; onSetFlow: (id: string) => void; onClose: () => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const current = path[step - 1];
  // Keep the current thumbnail in view by scrolling the strip only, never the page.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('.thumb.current');
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [step, flow.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, select, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === ']') { if (step < path.length) onGoTo(step + 1); }
      if (e.key === 'ArrowLeft' || e.key === '[') { if (step > 1) onGoTo(step - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, path.length, onGoTo]);

  const branchAt = current && current.options.length > 1 ? current : null;
  const selectedLabel = nodeId ? data.nodes[nodeId]?.label : '';

  return (
    <div className="player">
      <div className="player-head">
        <button className="nav" aria-label="Previous step" disabled={step <= 1} onClick={() => onGoTo(step - 1)}>‹</button>
        <button className="nav" aria-label="Next step" disabled={step >= path.length} onClick={() => onGoTo(step + 1)}>›</button>
        <select className="title-pick" value={flow.id} onChange={(e) => onSetFlow(e.target.value)} aria-label="Flow">
          {flows.map((f) => <option key={f.id} value={f.id}>{f.id} · {f.title}</option>)}
        </select>
        <span className="muted">
          Step {step} of {path.length}
          {!onStep && selectedLabel && <> · <b>{selectedLabel}</b> is not on this path · <button className="link" onClick={() => onGoTo(step)}>Back to the step</button></>}
        </span>
        {branchAt && (
          <span className="branches" role="radiogroup" aria-label="Way on from this step">
            {branchAt.options.map((o) => {
              const target = flow.steps.find((s) => s.mid === o.to);
              const on = branchAt.chosen?.to === o.to;
              return <button key={o.to} role="radio" aria-checked={on} className={`pill ${on ? 'on' : ''} w-${o.weight}`} onClick={() => onChoose(branchAt.mid, o.to)}
                title={`${o.weight === 'main' ? 'Main route' : o.weight === 'alt' ? 'Alternative' : 'Optional or way back'} → ${target?.label}`}>
                {o.label || target?.label}
              </button>;
            })}
          </span>
        )}
        <span className="spacer" />
        <span className="muted">← → or [ ] to step</span>
        <button className="ghost" onClick={onClose} aria-label="Close player">×</button>
      </div>
      <div className="filmstrip" ref={strip}>
        {path.map((s, i) => {
          const n = s.node ? data.nodes[s.node] : null;
          const shot = n?.screens?.[0];
          const branched = i > 0 && path[i - 1].options.length > 1;
          return (
            <span key={s.mid} className="strip-item">
              {i > 0 && <span className={`connector ${branched ? 'split' : ''}`} title={branched ? `Branch chosen: ${path[i - 1].chosen?.label}` : path[i - 1].chosen?.label}>{branched ? '⑂' : '›'}</span>}
              <button className={`thumb ${s.n === step ? 'current' : ''} kind-${s.kind}`} onClick={() => onGoTo(s.n)} aria-current={s.n === step ? 'step' : undefined}>
                {shot ? <img src={shot.src} alt="" /> : <span className="noshot">{s.kind === 'decision' ? '◇ Decision' : n ? 'No screenshot' : s.label}</span>}
                <span className="cap"><b>{s.n}</b> {s.label}</span>
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
