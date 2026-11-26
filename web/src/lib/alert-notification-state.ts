import type { AlertRecord } from './types';

export type AlertNoticeKind = 'sent' | 'response';

export interface AlertNotice {
  kind: AlertNoticeKind;
  alertId: string;
  eventId: string;
}

export interface AlertNoticeSeen {
  sentAt?: string;
  responseId?: string;
}

function lastResponseId(alert: AlertRecord): string | undefined {
  const response = alert.responses?.at(-1);
  return response ? `${response.at}:${response.code}:${response.message ?? ''}` : undefined;
}

export function noticeSnapshot(alert: AlertRecord): AlertNoticeSeen {
  return {
    sentAt: alert.serverReceivedAt,
    responseId: lastResponseId(alert),
  };
}

export function pendingAlertNotices(alert: AlertRecord, seen: AlertNoticeSeen): AlertNotice[] {
  if (alert.state === 'canceled') return [];
  const notices: AlertNotice[] = [];
  if (alert.serverReceivedAt && !seen.sentAt) {
    notices.push({ kind: 'sent', alertId: alert.id, eventId: alert.serverReceivedAt });
  }
  const responseId = lastResponseId(alert);
  if (responseId && responseId !== seen.responseId) {
    notices.push({ kind: 'response', alertId: alert.id, eventId: responseId });
  }
  return notices;
}

export function markAlertNotice(seen: AlertNoticeSeen, notice: AlertNotice): AlertNoticeSeen {
  return notice.kind === 'sent'
    ? { ...seen, sentAt: notice.eventId }
    : { ...seen, responseId: notice.eventId };
}
