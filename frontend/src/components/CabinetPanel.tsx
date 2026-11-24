import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, PenLine, Plus, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { fullDate } from '../lib/format';
import { cabinetLabel, circuitColor, circuitStats, formatPower, PHASES, toRoman } from '../lib/network';
import { useNetwork } from '../lib/queries';
import type { Cabinet, CabinetInput } from '../lib/types';
import type { Coords } from './PointPanel';
import { useToast } from './Toast';

interface Props {
  /** null = nowa szafa */
  cabinet: Cabinet | null;
  coords: Coords;
  onCoordsChange: (c: Coords) => void;
  onClose: () => void;
  onSaved?: (c: Cabinet) => void;
  /** Start trybu rysowania obwodu na mapie. */
  onDrawCircuit?: (circuitId: string) => void;
}

type CircuitRow = { key: number; id?: string; number: string; description: string };
let rowKey = 0;

export function CabinetPanel({ cabinet, coords, onCoordsChange, onClose, onSaved, onDrawCircuit }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const { idx } = useNetwork();

  const [number, setNumber] = useState(cabinet?.number ?? '');
  const [name, setName] = useState(cabinet?.name ?? '');
  const [notes, setNotes] = useState(cabinet?.notes ?? '');
  const [circuits, setCircuits] = useState<CircuitRow[]>(() =>
    cabinet
      ? cabinet.circuits.map((c) => ({ key: ++rowKey, id: c.id, number: String(c.number), description: c.description }))
      : [{ key: ++rowKey, number: '1', description: '' }],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const moved = !!cabinet && (cabinet.lat !== coords.lat || cabinet.lng !== coords.lng);
  const addressText = !cabinet
    ? 'Zostanie pobrany po zapisie'
    : moved
      ? 'Zaktualizuje się po zapisie'
      : cabinet.address ?? 'Nie udało się ustalić adresu';

  const removedWithPoles = cabinet
    ? cabinet.circuits.filter((c) => !circuits.some((r) => r.id === c.id) && (idx.byCircuit.get(c.id)?.length ?? 0) > 0)
    : [];
  const totalPoles = cabinet ? cabinet.circuits.reduce((n, c) => n + (idx.byCircuit.get(c.id)?.length ?? 0), 0) : 0;

  function addCircuit() {
    setCircuits((list) => {
      const max = Math.max(0, ...list.map((c) => Number(c.number) || 0));
      return [...list, { key: ++rowKey, number: String(max + 1), description: '' }];
    });
  }

  const save = useMutation({
    mutationFn: () => {
      const input: CabinetInput = {
        number: number.trim(),
        name: name.trim(),
        notes,
        lat: coords.lat,
        lng: coords.lng,
        circuits: circuits.map((c) => ({
          ...(c.id ? { id: c.id } : {}),
          number: Number(c.number),
          description: c.description.trim(),
        })),
      };
      return cabinet ? api.updateCabinet(cabinet.id, input) : api.createCabinet(input);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['cabinets'] });
      qc.invalidateQueries({ queryKey: ['points'] });
      toast(cabinet ? 'Zapisano szafę' : `Dodano ${cabinetLabel(saved)}`);
      onSaved?.(saved);
    },
    onError: (err) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteCabinet(cabinet!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinets'] });
      qc.invalidateQueries({ queryKey: ['points'] });
      toast('Usunięto szafę', 'red');
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const nums = circuits.map((c) => Number(c.number));
    if (nums.some((n) => !Number.isInteger(n) || n < 1)) return setError('Numer obwodu musi być liczbą od 1');
    if (new Set(nums).size !== nums.length) return setError('Numery obwodów muszą być unikalne');
    save.mutate();
  }

  function setCoord(key: keyof Coords, value: string) {
    const n = Number(value);
    if (value !== '' && Number.isFinite(n)) onCoordsChange({ ...coords, [key]: n });
  }

  return (
    <aside className="panel" aria-label={cabinet ? 'Edycja szafy SOU' : 'Nowa szafa SOU'}>
      <header className="panel-head">
        <h2 className="panel-title">
          <span className="panel-title-sou" aria-hidden="true" />
          {cabinet ? cabinetLabel(cabinet) : 'Nowa szafa SOU'}
        </h2>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Zamknij">
          <X size={16} strokeWidth={1.75} />
        </button>
      </header>

      <form className="panel-body" onSubmit={submit}>
        <section className="panel-section">
          <div className="field-row field-row-narrow">
            <label className="field">
              <span className="label">Numer szafy</span>
              <div className="input-group">
                <span className="input-prefix">SOU-</span>
                <input
                  className="input tabular"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="84"
                  maxLength={20}
                  autoFocus={!cabinet}
                  required
                />
              </div>
            </label>
            <label className="field">
              <span className="label">Opis / lokalizacja</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. ul. Wodzisławska"
                maxLength={200}
              />
            </label>
          </div>
        </section>

        <section className="panel-section">
          <h3 className="panel-section-title">
            Obwody
            <span className="panel-section-meta tabular">{circuits.length}</span>
          </h3>
          <div className="circuits">
            {circuits.map((c) => {
              const stats = c.id ? circuitStats(c.id, idx) : null;
              const n = Number(c.number) || 1;
              return (
                <div key={c.key} className="circuit-row">
                  <span className="circuit-swatch" style={{ background: circuitColor(n) }} />
                  <div className="input-group circuit-number">
                    <span className="input-prefix">Obw.</span>
                    <input
                      className="input input-sm tabular"
                      type="number"
                      min={1}
                      max={99}
                      value={c.number}
                      onChange={(e) =>
                        setCircuits((list) => list.map((x) => (x.key === c.key ? { ...x, number: e.target.value } : x)))
                      }
                      aria-label="Numer obwodu"
                      required
                    />
                  </div>
                  <input
                    className="input input-sm"
                    value={c.description}
                    onChange={(e) =>
                      setCircuits((list) => list.map((x) => (x.key === c.key ? { ...x, description: e.target.value } : x)))
                    }
                    placeholder="np. kier. Chopina"
                    maxLength={200}
                    aria-label="Opis obwodu"
                  />
                  {c.id && onDrawCircuit ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => onDrawCircuit(c.id!)}
                      title="Rysuj obwód na mapie"
                      aria-label={`Rysuj obwód ${toRoman(n)} na mapie`}
                    >
                      <PenLine size={14} strokeWidth={1.75} />
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setCircuits((list) => list.filter((x) => x.key !== c.key))}
                    aria-label="Usuń obwód"
                  >
                    <X size={14} strokeWidth={1.75} />
                  </button>
                  {stats && stats.poles > 0 && (
                    <div className="circuit-stats tabular">
                      {stats.poles} sł. · {stats.fixtures} opr. · {formatPower(stats.powerW)} ·{' '}
                      {stats.cableEstimated ? '≈' : ''}
                      {Math.round(stats.cableM)} m kabla
                      {stats.powerW > 0 && (
                        <span className="phase-bar" title="Obciążenie faz">
                          {PHASES.map((ph) => (
                            <span key={ph} className="phase-cell">
                              {ph} {formatPower(stats.phaseW[ph])}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" className="btn btn-secondary btn-sm btn-start" onClick={addCircuit}>
            <Plus size={14} strokeWidth={1.75} />
            Dodaj obwód
          </button>
          {removedWithPoles.length > 0 && (
            <p className="panel-hint panel-hint-tight panel-hint-warn">
              Usuwane obwody mają przypisane słupy — po zapisie staną się nieprzypisane.
            </p>
          )}
          {cabinet && onDrawCircuit && (
            <p className="panel-hint panel-hint-tight">
              <PenLine size={12} strokeWidth={1.75} /> rysuje obwód na mapie: każde kliknięcie dodaje kolejny słup.
            </p>
          )}
        </section>

        <section className="panel-section">
          <label className="field">
            <span className="label">Notatki</span>
            <textarea
              className="textarea textarea-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="np. typ szafy, zabezpieczenia, sterownik…"
              rows={3}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span className="label">Szerokość</span>
              <input
                className="input tabular"
                type="number"
                step="any"
                defaultValue={coords.lat}
                key={`lat-${coords.lat}`}
                onBlur={(e) => setCoord('lat', e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="label">Długość</span>
              <input
                className="input tabular"
                type="number"
                step="any"
                defaultValue={coords.lng}
                key={`lng-${coords.lng}`}
                onBlur={(e) => setCoord('lng', e.target.value)}
                required
              />
            </label>
          </div>
          <p className="panel-hint">
            {cabinet ? 'Przeciągnij znacznik na mapie, aby zmienić położenie.' : 'Kliknij na mapie albo przeciągnij znacznik.'}
          </p>
        </section>

        <div className="panel-info">
          <div className="panel-info-row">
            <MapPin size={14} strokeWidth={1.75} />
            <div>
              <div className="panel-info-label">Adres</div>
              <div className={cabinet?.address && !moved ? 'panel-info-value' : 'panel-info-muted'}>{addressText}</div>
            </div>
          </div>
        </div>

        {cabinet && (
          <dl className="panel-meta">
            <div>
              <dt>Słupy</dt>
              <dd className="tabular">{totalPoles}</dd>
            </div>
            <div>
              <dt>Utworzono</dt>
              <dd>{fullDate(cabinet.createdAt)}</dd>
            </div>
          </dl>
        )}

        {error && <p className="form-error">{error}</p>}
        {confirmDelete && totalPoles > 0 && (
          <p className="panel-hint panel-hint-tight panel-hint-warn">
            <span className="tabular">{totalPoles}</span> słupów z tej szafy stanie się nieprzypisanych.
          </p>
        )}

        <div className="panel-actions">
          <button className="btn btn-primary" disabled={save.isPending || !number.trim()}>
            {save.isPending ? 'Zapisywanie…' : cabinet ? 'Zapisz' : 'Dodaj szafę'}
          </button>
          <span className="spacer" />
          {cabinet &&
            (confirmDelete ? (
              <button type="button" className="btn btn-primary" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Potwierdź usunięcie
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-danger btn-icon"
                onClick={() => setConfirmDelete(true)}
                aria-label="Usuń szafę"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            ))}
        </div>
      </form>
    </aside>
  );
}
