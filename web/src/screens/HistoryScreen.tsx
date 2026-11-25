// Presenta los filtros y estados del historial de alertas y reportes.

import { biodiversityLabels } from '../i18n/labels';
import { LocalizedText, useTranslation } from '../i18n/LanguageContext';
import { useMemo, useState } from 'react';
import { Clock3, Inbox, Leaf, Plus, RefreshCw, TriangleAlert } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { AlertCard } from '../components/AlertCard';
import { EmptyState } from '../components/EmptyState';
import { formatDateTime, formatRelative } from '../lib/format';
import type { AlertState } from '../lib/types';

type Filter = 'all' | 'pending' | 'sent' | 'received';

const FILTERS: Filter[] = ['all', 'pending', 'sent', 'received'];

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
  const { t } = useTranslation();
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
          <p className="eyebrow">{t('history.esteTelefono')}</p>
          <h1><LocalizedText id="navigation.history" /></h1>
          <p className="screen-lead">{t('history.revisaQueSeEnvioYQue')}</p>
        </div>
        <button
          type="button"
          className="icon-btn"
          data-testid="history-refresh"
          onClick={() => void syncNow(true)}
          aria-label={t('history.actualizarEstados')}
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
              {pending.length === 1 ? t('history.1AlertaPendiente') : t('history.alertasPendientes', { count: pending.length })}
            </strong>
            <span>
              {online
                ? t('history.conConexionSeReintentaAutomaticamente')
                : t('history.sinConexionSaldranAlRecuperarSenal')}
            </span>
          </div>
          <button
            type="button"
            className="text-btn"
            onClick={() => void syncNow(true)}
            disabled={syncing}
          >
            <RefreshCw size={14} className={syncing ? 'spin' : ''} aria-hidden="true" />
            {syncing ? t('history.enviando') : t('common.retry')}
          </button>
        </div>
      ) : null}

      <button type="button" className="btn btn-danger btn-block btn-lg" onClick={onNew}>
        <TriangleAlert size={20} aria-hidden="true" />{' '}{t('history.nuevaEmergencia')}
      </button>

      <div className="filter-tabs" role="tablist" aria-label={t('history.filtrarAlertas')}>
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={filter === item}
            className={`filter-tab ${filter === item ? 'is-active' : ''}`}
            onClick={() => setFilter(item)}
          >
            {t(`history.filter.${item}`)}
            <span>{counts[item]}</span>
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
                  {t(alert.attempts === 1 ? 'history.attemptOne' : 'history.attemptOther', {
                    relativeTime: formatRelative(alert.lastAttemptAt, t),
                    count: alert.attempts,
                  })}
                </p>
              ) : null}
              {alert.lastSyncAttempt && !alert.lastSyncAttempt.ok ? (
                <div className="sync-diagnostic" data-testid={`sync-diagnostic-${alert.id}`}>
                  <strong>{t('history.syncDiagnostic.title')}</strong>
                  <p>{t('history.syncDiagnostic.time', {
                    time: formatDateTime(alert.lastSyncAttempt.attemptedAt, t),
                  })}</p>
                  <p>{t('history.syncDiagnostic.id', { id: alert.lastSyncAttempt.alertId })}</p>
                  <p>{t('history.syncDiagnostic.request', {
                    method: alert.lastSyncAttempt.method,
                    endpoint: alert.lastSyncAttempt.endpoint,
                  })}</p>
                  <p>{t('history.syncDiagnostic.attemptState', {
                    attempt: alert.lastSyncAttempt.attempt,
                    before: alert.lastSyncAttempt.stateBefore,
                    after: alert.lastSyncAttempt.stateAfter,
                  })}</p>
                  <p>{t('history.syncDiagnostic.http', {
                    status: alert.lastSyncAttempt.httpStatus ??
                      t('history.syncDiagnostic.noHttpStatus'),
                  })}</p>
                  <p>{t(alert.lastSyncAttempt.responseReceived
                    ? 'history.syncDiagnostic.responseReceived'
                    : alert.lastSyncAttempt.requestStarted
                      ? 'history.syncDiagnostic.deliveryUnknown'
                      : 'history.syncDiagnostic.requestNotStarted')}</p>
                  {alert.lastSyncAttempt.serverAlertId ? (
                    <p>{t('history.syncDiagnostic.serverId', {
                      id: alert.lastSyncAttempt.serverAlertId,
                    })}</p>
                  ) : null}
                  <p>{t('history.syncDiagnostic.error', {
                    error: alert.lastSyncAttempt.error,
                  })}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={filter === 'all' ? Inbox : Clock3}
          title={
            filter === 'all'
              ? t('history.noHayAlertasEnEsteTelefono')
              : t(`history.empty.${filter}`)
          }
        >
          {filter === 'all' ? (
            <>
              <p>{t('history.cuandoEnviesUnaEmergenciaVerasAqui')}</p>
              <button type="button" className="btn btn-primary" onClick={onNew}>
                <Plus size={18} aria-hidden="true" />{' '}{t('history.crearLaPrimeraAlerta')}
              </button>
            </>
          ) : (
            <p>{t('history.pruebaConOtroFiltroParaVer')}</p>
          )}
        </EmptyState>
      )}

      <section className="biodiversity-history" aria-labelledby="biodiversity-history-title">
        <div className="section-head">
          <h2 id="biodiversity-history-title">{t('history.misReportesDeBiodiversidad')}</h2>
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
                  <small>{t(biodiversityLabels[report.category] ?? 'emergency.otro')} · {formatRelative(report.createdAt, t)}</small>
                </span>
                <span className={`biodiversity-state is-${report.state}`}>
                  {report.state === 'read'
                    ? t('status.read')
                    : report.state === 'sent'
                      ? t('status.sent')
                      : t('status.pending')}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className="biodiversity-history-empty">{t('history.aquiApareceraElEstadoDeTus')}</p>
        )}
      </section>
    </div>
  );
}
