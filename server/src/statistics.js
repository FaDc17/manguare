const ZONE = 'America/Lima';
const dateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function parts(iso) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return Object.fromEntries(dateParts.formatToParts(new Date(time)).map((part) => [part.type, part.value]));
}

export function limaDate(iso) {
  const value = parts(iso);
  return value ? `${value.year}-${value.month}-${value.day}` : null;
}

export function limaDateTime(iso) {
  const value = parts(iso);
  return value ? `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}:${value.second}` : null;
}

function shiftDays(day, offset) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function validDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

export function readPeriod(query, now = new Date()) {
  const today = limaDate(now.toISOString());
  const period = query.get('period') ?? 'last30';
  if (period === 'last7') return { from: shiftDays(today, -6), to: today, key: period };
  if (period === 'last30') return { from: shiftDays(today, -29), to: today, key: period };
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today, key: period };
  const from = query.get('from');
  const to = query.get('to');
  if (period !== 'custom' || !validDay(from) || !validDay(to) || from > to) return null;
  return { from, to, key: period };
}

export function buildStatistics(alerts, period) {
  const seen = new Set();
  const detail = [];
  const byType = {};
  const byStatus = { sent: 0, received: 0 };
  const monthly = new Map();
  let confirmationSum = 0;
  let confirmationCount = 0;

  for (const alert of alerts) {
    if (!alert || typeof alert.id !== 'string' || seen.has(alert.id)) continue;
    seen.add(alert.id);
    const day = limaDate(alert.serverReceivedAt);
    if (!day || day < period.from || day > period.to) continue;
    if (typeof alert.type !== 'string') continue;
    const type = alert.type;
    const status = alert.acknowledgedAt ? 'received' : 'sent';
    const receivedMs = Date.parse(alert.serverReceivedAt);
    const ackMs = alert.acknowledgedAt ? Date.parse(alert.acknowledgedAt) : NaN;
    const confirmationMinutes = Number.isFinite(ackMs) && ackMs >= receivedMs
      ? (ackMs - receivedMs) / 60_000 : null;
    if (confirmationMinutes !== null) {
      confirmationSum += confirmationMinutes;
      confirmationCount += 1;
    }
    byType[type] = (byType[type] ?? 0) + 1;
    byStatus[status] += 1;
    const month = day.slice(0, 7);
    const row = monthly.get(month) ?? { month, count: 0, byType: {}, byStatus: { sent: 0, received: 0 } };
    row.count += 1;
    row.byType[type] = (row.byType[type] ?? 0) + 1;
    row.byStatus[status] += 1;
    monthly.set(month, row);
    detail.push({
      id: alert.id,
      type,
      status,
      clientCreatedAt: alert.clientCreatedAt,
      serverReceivedAt: alert.serverReceivedAt,
      acknowledgedAt: alert.acknowledgedAt ?? null,
      confirmationMinutes,
    });
  }

  detail.sort((a, b) => String(a.serverReceivedAt).localeCompare(String(b.serverReceivedAt)));
  return {
    period,
    total: detail.length,
    byType,
    byStatus,
    averageConfirmationMinutes: confirmationCount ? confirmationSum / confirmationCount : null,
    confirmationCount,
    monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
    detail,
  };
}

/** Muestra aislada: nunca se guarda ni pasa por las rutas de alertas. */
export function demoStatisticsAlerts(now = new Date()) {
  const day = 86_400_000;
  return [2, 3, 8, 15, 31, 47].map((age, index) => {
    const received = new Date(now.getTime() - age * day);
    return {
      id: `DEMO-estadistica-${index + 1}`,
      type: ['enfermedad', 'accidente', 'parto', 'mordedura', 'otro', 'enfermedad'][index],
      clientCreatedAt: new Date(received.getTime() - 20 * 60_000).toISOString(),
      serverReceivedAt: received.toISOString(),
      ...(index % 3 !== 1 ? { acknowledgedAt: new Date(received.getTime() + (index + 1) * 12 * 60_000).toISOString() } : {}),
    };
  });
}
