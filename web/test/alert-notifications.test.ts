import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  markAlertNotice, noticeSnapshot, pendingAlertNotices,
} from '../src/lib/alert-notification-state.ts';
import type { AlertRecord } from '../src/lib/types.ts';

describe('avisos de alertas', () => {
  const pending = {
    id: 'alerta-1', state: 'pending', createdAt: '2026-11-26T12:00:00Z',
  } as AlertRecord;

  it('avisa una sola vez cuando la alerta pendiente llega al servidor', () => {
    const sent = { ...pending, state: 'sent' as const,
      serverReceivedAt: '2026-11-26T12:01:00Z' };
    const notices = pendingAlertNotices(sent, noticeSnapshot(pending));
    assert.deepEqual(notices.map((notice) => notice.kind), ['sent']);
    assert.deepEqual(pendingAlertNotices(sent, markAlertNotice({}, notices[0])), []);
  });

  it('avisa al llegar una respuesta nueva y no repite la anterior', () => {
    const sent = { ...pending, state: 'sent' as const,
      serverReceivedAt: '2026-11-26T12:01:00Z' };
    const answered = { ...sent, state: 'received' as const, responses: [
      { code: 'en_camino', at: '2026-11-26T12:02:00Z' },
    ] };
    const notices = pendingAlertNotices(answered, noticeSnapshot(sent));
    assert.deepEqual(notices.map((notice) => notice.kind), ['response']);
    const seen = markAlertNotice(noticeSnapshot(sent), notices[0]);
    assert.deepEqual(pendingAlertNotices(answered, seen), []);
    assert.deepEqual(pendingAlertNotices({ ...answered, responses: [
      ...answered.responses, { code: 'otra', message: 'Acude a la posta', at: '2026-11-26T12:03:00Z' },
    ] }, seen).map((notice) => notice.kind), ['response']);
  });

  it('no avisa por una alerta anulada ni por eventos ya existentes al activar', () => {
    const answered = { ...pending, state: 'received' as const,
      serverReceivedAt: '2026-11-26T12:01:00Z', responses: [
        { code: 'en_camino', at: '2026-11-26T12:02:00Z' },
      ] };
    assert.deepEqual(pendingAlertNotices(answered, noticeSnapshot(answered)), []);
    assert.deepEqual(pendingAlertNotices({ ...answered, state: 'canceled' }, {}), []);
  });
});
