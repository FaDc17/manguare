import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  authenticate,
  DEMO_ACCOUNTS,
  formatPhone,
  normalizePhone,
  roleLabel,
  saveProfileName,
} from '../src/lib/session';

test('acepta los dos accesos de demo con su PIN', () => {
  const user = authenticate('992066275', '123456');
  assert.equal(user?.name, 'Juan');
  assert.equal(user?.role, 'user');

  const admin = authenticate('987654321', '123456');
  assert.equal(admin?.role, 'admin');

  assert.equal(authenticate('+51 992 066 275', '123456')?.name, 'Juan');
  assert.equal(authenticate('992066275', '654321'), null);
  assert.equal(authenticate('000000000', '123456'), null);
  assert.equal(DEMO_ACCOUNTS.length, 2);
});

test('normaliza y formatea el número peruano de 9 dígitos', () => {
  assert.equal(normalizePhone('992 066 275'), '992066275');
  assert.equal(normalizePhone('+51 992-066-275'), '51992066275');
  assert.equal(formatPhone('992066275'), '992 066 275');
  assert.equal(formatPhone('51992066275'), '+51 992 066 275');
});

test('etiqueta los roles para la interfaz', () => {
  assert.equal(roleLabel('user'), 'Miembro de la comunidad');
  assert.equal(roleLabel('admin'), 'Administrador de la red');
});

test('conserva el nombre editado del perfil al volver a iniciar sesión', () => {
  const entries = new Map<string, string>();
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  } });
  try {
    saveProfileName('992066275', 'María');
    assert.equal(authenticate('992066275', '123456')?.name, 'María');
    assert.throws(() => saveProfileName('992066275', '   '));
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  }
});
