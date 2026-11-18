import { useMemo, useState } from 'react';
import { Clock3, Inbox, Leaf, Plus, RefreshCw, TriangleAlert } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { AlertCard } from '../components/AlertCard';
import { EmptyState } from '../components/EmptyState';
import { formatRelative } from '../lib/format';
import type { AlertState } from '../lib/types';

type Filter = 'all' | 'pending' | 'sent' | 'received';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'sent', label: 'Enviadas' },
  { id: 'received', label: 'Recibidas' },
];

function matches(state: AlertState, filter: Filter): boolean {
  if (filter === 'all') return true;
  return state === filter;
}

export function HistoryScreen({
  onOpenAlert,
  onNew,
}: {
  onOpenAlert: (id: string) => void;
  onNew: () => void;
}) {
  const { alerts, biodiversityReports, online, syncing, syncNow } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const pending = alerts.filter((alert) => alert.state === 'pending');
  const filtered = useMemo(
    () => alerts.filter((alert) => matches(alert.state, filter)),
    [alerts, filter],
  );

  const counts: Record<Filter, number> = {
    all: alerts.length,
    pending: alerts.filter((alert) => alert.state === 'pending').length,
    sent: alerts.filter((alert) => alert.state === 'sent').length,
    received: alerts.filter((alert) => alert.state === 'received').length,
  };

  return (
    <div className="screen history">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Este teléfono</p>
          <h1>Mis alertas</h1>
          <p className="screen-lead">Revisa qué se envió y qué sigue pendiente.</p>
        </div>
        <button
          type="button"
          className="icon-btn"
          data-testid="history-refresh"
          onClick={() => void syncNow(true)}
          aria-label="Actualizar estados"
        >
          <RefreshCw size={20} className={syncing ? 'spin' : ''} aria-hidden="true" />
        </button>
      </header>

      {pending.length > 0 ? (
        <div className="pending-card pending-card--compact">
          <span className="pending-icon">
            <Clock3 size={21} aria-hidden="true" />
          </span>
          <div className="pending-copy">
            <strong>
              {pending.length === 1 ? '1 alerta pendiente' : `${pending.length} alertas pendientes`}
            </strong>
            <span>
              {online
                ? 'Con conexión: se reintenta automáticamente.'
                : 'Sin conexión: saldrán al recuperar señal.'}
            </span>
          </div>
          <button
            type="button"
            className="text-btn"
            onClick={() => void syncNow(true)}
            disabled={syncing}
          >
            <RefreshCw size={14} className={syncing ? 'spin' : ''} aria-hidden="true" />
            {syncing ? 'Enviando' : 'Reintentar'}
          </button>
        </div>
      ) : null}

      <button type="button" className="btn btn-danger btn-block btn-lg" onClick={onNew}>
        <TriangleAlert size={20} aria-hidden="true" /> Nueva emergencia
      </button>

      <div className="filter-tabs" role="tablist" aria-label="Filtrar alertas">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className={`filter-tab ${filter === item.id ? 'is-active' : ''}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            <span>{counts[item.id]}</span>
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="alert-list">
          {filtered.map((alert) => (
            <div key={alert.id}>
              <AlertCard alert={alert} onOpen={onOpenAlert} />
              {alert.state === 'pending' && alert.lastAttemptAt ? (
                <p className="attempt-note">
                  Último intento {formatRelative(alert.lastAttemptAt)} · {alert.attempts}{' '}
                  {alert.attempts === 1 ? 'intento' : 'intentos'}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={filter === 'all' ? Inbox : Clock3}
          title={
            filter === 'all'
              ? 'No hay alertas en este teléfono'
              : `No hay alertas ${FILTERS.find((item) => item.id === filter)?.label.toLowerCase()}`
          }
        >
          {filter === 'all' ? (
            <>
              <p>Cuando envíes una emergencia verás aquí su estado y su recorrido.</p>
              <button type="button" className="btn btn-primary" onClick={onNew}>
                <Plus size={18} aria-hidden="true" /> Crear la primera alerta
              </button>
            </>
          ) : (
            <p>Prueba con otro filtro para ver el resto del historial.</p>
          )}
        </EmptyState>
      )}

      <section className="biodiversity-history" aria-labelledby="biodiversity-history-title">
        <div className="section-head">
          <h2 id="biodiversity-history-title">Mis reportes de biodiversidad</h2>
        </div>
        {biodiversityReports.length ? (
          <div className="biodiversity-history-list">
            {biodiversityReports.map((report) => (
              <article
                className="biodiversity-history-card"
                data-testid={`biodiversity-report-${report.id}`}
                key={report.id}
              >
                <span className="biodiversity-history-icon"><Leaf size={18} aria-hidden="true" /></span>
                <span className="biodiversity-history-copy">
                  <strong>{report.title}</strong>
                  <small>{report.category} · {formatRelative(report.createdAt)}</small>
                </span>
                <span className={`biodiversity-state is-${report.state}`}>
                  {report.state === 'read'
                    ? 'Leída'
                    : report.state === 'sent'
                      ? 'Enviada'
                      : 'Pendiente'}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className="biodiversity-history-empty">Aquí aparecerá el estado de tus reportes.</p>
        )}
      </section>
    </div>
  );
}
