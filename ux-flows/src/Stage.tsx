import { Fragment, useState } from 'react';
import type { Data, Flow, PathStep, Shot } from './model';
import { ancestors } from './model';

const TONE: Record<string, string> = { Observed: 'ok', Specified: 'warn', 'Not captured': 'warn', 'Partly observed': 'warn' };

export function Badge({ text, tone }: { text: string; tone?: string }) {
  return <span className={`badge ${tone ?? TONE[text] ?? 'neutral'}`}>{text}</span>;
}

export function Stage({ data, nodeId, step, flow, onSelect }: {
  data: Data; nodeId: string | null; step: PathStep | null; flow: Flow | null; onSelect: (id: string) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  // A flow step without a screen (a decision) takes the stage instead of the selected screen.
  if (step && !step.node) {
    return (
      <div className="stage">
        <div className="stage-head"><h1>{step.label}</h1><Badge text={step.kind === 'decision' ? 'Decision' : 'No screenshot'} tone="neutral" /></div>
        <div className="stage-body decision">
          <div className="diamond">{step.kind === 'decision' ? '◇' : '✎'}</div>
          <p>{step.kind === 'decision'
            ? <>Step {step.n} of {flow?.id}: a branch point, not a screen. Choose a way on in the player below.</>
            : <>Step {step.n} of {flow?.id}: an action in the app that is not URL state, so it has no capture. The next step shows its result.</>}</p>
          <ul>{step.options.map((o) => <li key={o.to}><button className="link" onClick={() => { const t = flow?.steps.find((s) => s.mid === o.to); if (t?.node) onSelect(t.node); }}>{o.label || o.to}</button> <span className="muted">→ {flow?.steps.find((s) => s.mid === o.to)?.label}</span></li>)}</ul>
        </div>
      </div>
    );
  }
  const n = nodeId ? data.nodes[nodeId] : null;
  if (!n) return <div className="stage" />;
  const shot = n.screens?.[0];
  const crumbs = ancestors(data.nodes, n.id);
  return (
    <div className="stage">
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c) => <span key={c}><button className="link" onClick={() => onSelect(c)}>{data.nodes[c].label}</button> › </span>)}
      </nav>
      <div className="stage-head">
        <h1>{n.label}</h1>
        {n.kind !== 'group' && n.kind !== 'product' && <Badge text={n.kind === 'state' ? 'State' : 'Screen'} tone="neutral" />}
        {n.evidence && <Badge text={n.evidence} />}
        {shot && <button className="ghost" onClick={() => setZoomed(true)}>⤢ Enlarge</button>}
      </div>
      <div className="stage-body">
        {shot ? (
          <figure className="shot" style={{ aspectRatio: `${shot.width} / ${shot.height}` }}>
            <img src={shot.src} alt={`Screenshot of ${n.label}`} loading="lazy" />
            <figcaption className="muted">Desktop {shot.width}×{shot.height} · captured {new Date(shot.capturedAt).toLocaleString()} · sha {shot.sha}</figcaption>
          </figure>
        ) : n.children.length ? (
          <div className="gallery">
            {n.summary && <p className="lede">{n.summary}</p>}
            <div className="cards">
              {n.children.map((c) => {
                const ch = data.nodes[c]; const s = ch.screens?.[0] ?? firstShot(data, c);
                return <button key={c} className="card" onClick={() => onSelect(c)}>
                  {s ? <img src={s.src} alt="" /> : <div className="noshot">No screenshot</div>}
                  <span>{ch.label}</span>{ch.children.length > 0 && <span className="muted"> · {ch.children.length}</span>}
                </button>;
              })}
            </div>
          </div>
        ) : (
          <div className="noshot big">
            <p>No screenshot{n.captureError ? `: ${n.captureError}` : ' yet. Run `npm run capture` to observe it.'}</p>
            {n.url && <a href={n.url} target="_blank" rel="noreferrer">Open this state in Terrain Viewer ↗</a>}
          </div>
        )}
      </div>
      {zoomed && shot && (
        <div className="lightbox" role="dialog" aria-label={`${n.label}, enlarged`} onClick={() => setZoomed(false)}>
          <img src={shot.src} alt={`Screenshot of ${n.label}`} />
          <button className="close" aria-label="Close">×</button>
        </div>
      )}
    </div>
  );
}

function firstShot(data: Data, id: string): Shot | null {
  const n = data.nodes[id];
  if (n.screens?.length) return n.screens[0];
  for (const c of n.children) { const s: Shot | null = firstShot(data, c); if (s) return s; }
  return null;
}

export function Inspector({ data, nodeId, flow, currentStep, onSetFlow, onSelect }: {
  data: Data; nodeId: string | null; flow: Flow | null; currentStep: PathStep | null; onSetFlow: (id: string) => void; onSelect: (id: string) => void;
}) {
  const n = nodeId ? data.nodes[nodeId] : null;
  if (!n) return <aside className="inspector" />;
  const params = n.params ? Object.entries(n.params) : [];
  const interesting = params.filter(([k]) => !['viewMode', 'lat', 'lng', 'place'].includes(k));
  return (
    <aside className="inspector">
      <section>
        <h2>About</h2>
        {n.how && <p>{n.how}</p>}
        {n.summary && <p>{n.summary}</p>}
        <dl className="meta">
          <dt>Map ID</dt><dd><code>{n.id}</code></dd>
          {n.screens?.[0] && <><dt>Screenshot</dt><dd><code>{n.screens[0].src}</code></dd></>}
          {n.url && <><dt>Viewer URL</dt><dd><a href={n.url} target="_blank" rel="noreferrer">open this state ↗</a></dd></>}
        </dl>
      </section>
      {interesting.length > 0 && (
        <details open>
          <summary>URL state <span className="count">{interesting.length}</span></summary>
          <dl className="meta">{interesting.map(([k, v]) => <Fragment key={k}><dt><code>{k}</code></dt><dd><code>{v}</code></dd></Fragment>)}</dl>
        </details>
      )}
      {n.flows.length > 0 && (
        <section>
          <h2>In flows <span className="count">{n.flows.length}</span></h2>
          {n.flows.map((id) => {
            const f = data.flows.find((x) => x.id === id)!;
            return <button key={id} className={`flow-card ${flow?.id === id ? 'on' : ''}`} onClick={() => onSetFlow(id)}>
              <b>{id}</b> {f.title}<br /><span className="muted">{f.evidence}{flow?.id === id && currentStep ? ` · playing, step ${currentStep.n}` : ''}</span>
            </button>;
          })}
        </section>
      )}
      {(n.linksTo?.length || n.linkedFrom?.length) ? (
        <details open>
          <summary>Connections <span className="count">{(n.linkedFrom?.length ?? 0) + (n.linksTo?.length ?? 0)}</span></summary>
          {n.linkedFrom?.length ? <p className="muted">Reached from</p> : null}
          <ul className="links">{data.links.filter((l) => l.to === n.id).map((l) => (
            <li key={l.from}><button className="link" onClick={() => onSelect(l.from)}>{data.nodes[l.from].label}</button>
              <span className="muted"> {l.label ? `· "${l.label}"` : ''}{l.weight === 'optional' ? ' · way back' : ''} · {l.flows.join(', ')}</span></li>
          ))}</ul>
          {n.linksTo?.length ? <p className="muted">Leads to</p> : null}
          <ul className="links">{data.links.filter((l) => l.from === n.id).map((l) => (
            <li key={l.to}><button className="link" onClick={() => onSelect(l.to)}>{data.nodes[l.to].label}</button>
              <span className="muted"> {l.label ? `· "${l.label}"` : ''}{l.weight === 'optional' ? ' · way back' : ''} · {l.flows.join(', ')}</span></li>
          ))}</ul>
        </details>
      ) : null}
      {flow && (
        <details>
          <summary>About flow {flow.id}</summary>
          <p>{flow.intro}</p>
          {flow.notes && <p className="muted">{flow.notes}</p>}
          <p className="muted">Source: <code>{flow.source}</code></p>
        </details>
      )}
    </aside>
  );
}
