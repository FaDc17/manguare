import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSmsBody, smsHref } from '../src/lib/sms.ts';
import type { AlertRecord } from '../src/lib/types.ts';

describe('SMS de respaldo', () => {
  const alert = {
    id: 'alerta-12345678', type: 'mordedura', note: 'Mordedura de serpiente en el brazo',
    community: 'Awajun', location: { lat: -12.12345, lng: -77.12345 },
  } as AlertRecord;

  it('conserva el mensaje existente y añade la descripción corta', () => {
    const body = buildSmsBody(alert);
    assert.ok(body.startsWith('DEVUT EMERGENCIA | Mordedura | Awajun | geo:-12.12345,-77.12345 | Ref '));
    assert.ok(body.endsWith(' | Detalle: Mordedura de serpiente en el brazo'));
    assert.ok(decodeURIComponent(smsHref('+51 999 888 777', body)).includes(body));
  });

  it('recorta una descripción extensa y no añade un campo vacío', () => {
    const long = buildSmsBody({ ...alert, note: '  Dolor  muy fuerte\n' + 'x'.repeat(100) });
    assert.match(long, /Detalle: Dolor muy fuerte /);
    assert.ok(long.split('Detalle: ')[1].length <= 48);
    assert.ok(!buildSmsBody({ ...alert, note: '  ' }).includes('Detalle:'));
  });
});
