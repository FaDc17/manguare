import { useEffect, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

type PeriodKey = 'last7' | 'last30' | 'month' | 'custom';
interface Statistics {
  period: { from: string; to: string; key: PeriodKey };
  total: number;
  byType: Record<string, number>;
  byStatus: { sent: number; received: number };
  averageConfirmationMinutes: number | null;
  confirmationCount: number;
  monthly: Array<{ month: string; count: number }>;
  demo: boolean;
  demoAvailable: boolean;
}

function BarList({ rows }: { rows: Array<{ label: string; count: number }> }) {
  const maximum = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="report-bars">
      {rows.map((row) => (
        <div className="report-bar-row" key={row.label}>
          <span>{row.label}</span>
          <div className="report-bar-track" aria-hidden="true">
            <div style={{ width: `${row.count / maximum * 100}%` }} />
          </div>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  );
}

export function StatisticsSection({ revision }: { revision: string }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<PeriodKey>('last30');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const [demoAvailable, setDemoAvailable] = useState(false);
  const validRange = period !== 'custom' || (Boolean(from && to) && from <= to);
  const query = new URLSearchParams({ period, ...(period === 'custom' ? { from, to } : {}), ...(demo ? { demo: '1' } : {}) }).toString();

  useEffect(() => {
    if (!validRange) { setData(null); return; }
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setError('');
    void fetch(`/api/panel/statistics?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Statistics>;
      })
      .then((result) => { setDemoAvailable(result.demoAvailable); setData(result); })
      .catch((reason) => {
        if (reason?.name !== 'AbortError') setError(t('statistics.loadError'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, revision, validRange, t]);

  const download = async () => {
    if (!validRange || exporting) return;
    setExporting(true);
    setError('');
    try {
      const response = await fetch(`/api/panel/statistics/export?${query}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1];
      link.download = filename ?? 'Manguare_Informe_Emergencias.xlsx';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError(t('statistics.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const typeRows = Object.entries(data?.byType ?? {}).sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
  const monthRows = (data?.monthly ?? []).map((row) => ({ label: row.month, count: row.count }));
  const statusRows = [
    { label: t('status.sent'), count: data?.byStatus.sent ?? 0 },
    { label: t('status.received'), count: data?.byStatus.received ?? 0 },
  ];

  return (
    <section className="panel-report-section" aria-labelledby="panel-report-title" data-testid="statistics-section">
      <div className="panel-report-head">
        <div>
          <p className="panel-kicker">{t('statistics.analysis')}</p>
          <h2 id="panel-report-title">{t('statistics.title')}</h2>
        </div>
        <button className="panel-report-export" type="button" onClick={() => void download()}
          disabled={!validRange || exporting || loading || !data} data-testid="statistics-export">
          {exporting ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}
          {t('statistics.export')}
        </button>
      </div>
      <div className="panel-report-filters">
        <label>{t('statistics.period')}
          <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodKey)} data-testid="statistics-period">
            <option value="last7">{t('statistics.last7')}</option>
            <option value="last30">{t('statistics.last30')}</option>
            <option value="month">{t('statistics.month')}</option>
            <option value="custom">{t('statistics.custom')}</option>
          </select>
        </label>
        {period === 'custom' ? (
          <>
            <label>{t('statistics.from')}<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label>{t('statistics.to')}<input type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></label>
          </>
        ) : null}
        {demoAvailable ? (
          <label className="panel-report-demo-toggle">
            <input type="checkbox" checked={demo} onChange={(event) => setDemo(event.target.checked)} data-testid="statistics-demo" />
            {t('statistics.demoMode')}
          </label>
        ) : null}
      </div>
      {period === 'custom' && !validRange ? <p className="panel-report-note">{t('statistics.chooseRange')}</p> : null}
      {error ? <p className="panel-report-error" role="alert">{error}</p> : null}
      {loading && !data ? <p className="panel-report-note">{t('statistics.loading')}</p> : null}
      {data && validRange ? (
        <>
          <p className="panel-report-note">{data.demo ? <strong className="panel-report-demo-badge">{t('statistics.demoBadge')}</strong> : null}{data.period.from} — {data.period.to} · {t('statistics.timezone')}{data.demo ? ` · ${t('statistics.fictional')}` : ''}</p>
          <div className="panel-report-kpis">
            <div><span>{t('statistics.total')}</span><strong data-testid="statistics-total">{data.total}</strong></div>
            <div><span>{t('statistics.average')}</span><strong>{data.averageConfirmationMinutes === null ? '—' : `${Math.round(data.averageConfirmationMinutes * 100) / 100} min`}</strong></div>
          </div>
          {data.total === 0 ? <p className="panel-report-empty">{t('statistics.empty')}</p> : (
            <div className="panel-report-charts">
              <div><h3>{t('statistics.byMonth')}</h3><BarList rows={monthRows} /></div>
              <div><h3>{t('statistics.byType')}</h3><BarList rows={typeRows} /></div>
              <div><h3>{t('statistics.byStatus')}</h3><BarList rows={statusRows} /></div>
            </div>
          )}
          <p className="panel-report-note">{t('statistics.pendingNote')}</p>
        </>
      ) : null}
    </section>
  );
}
