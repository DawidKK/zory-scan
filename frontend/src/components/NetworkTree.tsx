import { useState } from 'react';
import { ChevronRight, PenLine } from 'lucide-react';
import {
  cabinetLabel,
  circuitColor,
  circuitLabel,
  circuitTree,
  type NetworkIndex,
} from '../lib/network';
import type { Cabinet, Point } from '../lib/types';

interface Props {
  idx: NetworkIndex;
  cabinets: Cabinet[];
  selectedId: string | null;
  /** Obwód aktualnie rysowany na mapie. */
  drawingCircuitId: string | null;
  onSelectPoint: (p: Point) => void;
  onSelectCabinet: (c: Cabinet) => void;
  onDrawCircuit: (circuitId: string) => void;
}

export function NetworkTree({
  idx,
  cabinets,
  selectedId,
  drawingCircuitId,
  onSelectPoint,
  onSelectCabinet,
  onDrawCircuit,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (cabinets.length === 0 && idx.unassigned.length === 0) {
    return <div className="empty">Brak szaf i słupów. Dodaj szafę SOU na mapie.</div>;
  }

  return (
    <div className="tree" role="tree">
      {cabinets.map((cab) => {
        const open = !collapsed.has(cab.id);
        const poles = cab.circuits.reduce((n, c) => n + (idx.byCircuit.get(c.id)?.length ?? 0), 0);
        return (
          <div key={cab.id} role="treeitem" aria-expanded={open}>
            <div className={`tree-row tree-cabinet ${selectedId === cab.id ? 'tree-row-active' : ''}`}>
              <button className="tree-toggle" onClick={() => toggle(cab.id)} aria-label={open ? 'Zwiń' : 'Rozwiń'}>
                <ChevronRight size={14} strokeWidth={1.75} className={open ? 'tree-chevron-open' : ''} />
              </button>
              <button className="tree-label" onClick={() => onSelectCabinet(cab)}>
                <span className="sou-swatch" />
                <span className="tree-title">{cabinetLabel(cab)}</span>
                {cab.name && <span className="tree-meta">{cab.name}</span>}
              </button>
              <span className="tree-count tabular">{poles}</span>
            </div>

            {open &&
              cab.circuits.map((c) => {
                const key = `c:${c.id}`;
                const cOpen = !collapsed.has(key);
                const rows = circuitTree(c.id, idx);
                const drawing = drawingCircuitId === c.id;
                return (
                  <div key={c.id} role="group">
                    <div className={`tree-row tree-circuit ${drawing ? 'tree-row-drawing' : ''}`}>
                      <button
                        className="tree-toggle"
                        onClick={() => toggle(key)}
                        disabled={rows.length === 0}
                        aria-label={cOpen ? 'Zwiń' : 'Rozwiń'}
                      >
                        {rows.length > 0 && (
                          <ChevronRight size={14} strokeWidth={1.75} className={cOpen ? 'tree-chevron-open' : ''} />
                        )}
                      </button>
                      <span className="tree-label tree-label-static">
                        <span className="circuit-swatch" style={{ background: circuitColor(c.number) }} />
                        <span className="tree-title">{circuitLabel(c)}</span>
                        {c.description && <span className="tree-meta">{c.description}</span>}
                      </span>
                      <span className="tree-count tabular">{rows.length}</span>
                      <button
                        className="btn btn-ghost btn-icon btn-xs"
                        onClick={() => onDrawCircuit(c.id)}
                        title="Rysuj obwód na mapie"
                        aria-label={`Rysuj ${circuitLabel(c)} na mapie`}
                      >
                        <PenLine size={13} strokeWidth={1.75} />
                      </button>
                    </div>
                    {cOpen &&
                      rows.map(({ point, depth }) => (
                        <button
                          key={point.id}
                          className={`tree-row tree-pole ${selectedId === point.id ? 'tree-row-active' : ''}`}
                          style={{ paddingLeft: 52 + depth * 14 }}
                          onClick={() => onSelectPoint(point)}
                        >
                          <span className={`tree-pole-dot ${point.status === 'planned' ? 'tree-pole-planned' : ''}`} />
                          <span className="tree-title tabular">{point.number ?? '?'}</span>
                          {point.fixtures.length > 0 && (
                            <span className="tree-meta tabular">
                              {point.fixtures.map((f) => f.phase ?? '—').join(' ')}
                            </span>
                          )}
                          {point.name && <span className="tree-meta tree-meta-name">{point.name}</span>}
                        </button>
                      ))}
                  </div>
                );
              })}
          </div>
        );
      })}

      {idx.unassigned.length > 0 && (
        <div role="treeitem" aria-expanded={!collapsed.has('unassigned')}>
          <div className="tree-row tree-cabinet">
            <button className="tree-toggle" onClick={() => toggle('unassigned')} aria-label="Rozwiń">
              <ChevronRight
                size={14}
                strokeWidth={1.75}
                className={!collapsed.has('unassigned') ? 'tree-chevron-open' : ''}
              />
            </button>
            <span className="tree-label tree-label-static">
              <span className="tree-title tree-title-muted">Nieprzypisane</span>
            </span>
            <span className="tree-count tabular">{idx.unassigned.length}</span>
          </div>
          {!collapsed.has('unassigned') &&
            idx.unassigned.map((p) => (
              <button
                key={p.id}
                className={`tree-row tree-pole ${selectedId === p.id ? 'tree-row-active' : ''}`}
                style={{ paddingLeft: 38 }}
                onClick={() => onSelectPoint(p)}
              >
                <span className="tree-pole-dot" />
                <span className="tree-title">{p.name || 'Słup bez numeru'}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
