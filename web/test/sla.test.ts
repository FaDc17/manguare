import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deadlineText, isOverdue, responseText } from '../src/lib/sla';
import type { AlertRecord } from '../src/lib/types';

const base: AlertRecord = {
  id: 'sla-web-0001',
  type: 'enfermedad',
  note: '',
  community: '',
  deviceName: '',
  consentLocation: false,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
  state: 'sent',
  attempts: 1,
  serverReceivedAt: '2026-11-18T10:00:00.000Z',
  ackDeadlineAt: '2026-11-18T10:10:00.000Z',
};

test('detecta el plazo vencido solo si no fue confirmada', () => {
  const now = Date.parse('2026-11-18T10:11:00.000Z');
  assert.equal(isOverdue(base, now), true);
  assert.equal(isOverdue({ ...base, acknowledgedAt: '2026-11-18T10:05:00.000Z' }, now), false);
  assert.equal(isOverdue({ ...base, state: 'canceled' }, now), false);
  assert.equal(isOverdue({ ...base, ackDeadlineAt: undefined }, now), false);
  assert.equal(isOverdue(base, Date.parse('2026-11-18T10:05:00.000Z')), false);
});

test('muestra el plazo y el texto de la respuesta', () => {
  assert.match(deadlineText(base) ?? '', /^\d{2}:\d{2}/);
  assert.equal(deadlineText({ ...base, ackDeadlineAt: undefined }), null);
  assert.equal(responseText({ code: 'en_camino', at: '2026-11-18T10:00:00.000Z' }), 'Ambulancia o brigada en camino');
  assert.equal(
    responseText({ code: 'otra', message: 'Llevar agua', at: '2026-11-18T10:00:00.000Z' }),
    'Llevar agua',
  );
});
