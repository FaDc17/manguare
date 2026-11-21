// Verifica los catálogos, el respaldo en español, la preferencia de idioma y el audio de prueba.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { isLanguageComplete, LANGUAGES, messageLanguage, translate, type Translate, type VisualCatalog } from '../src/i18n/catalog';
import { formatDateTime, formatRelative } from '../src/lib/format';
import { guideText } from '../src/lib/audio';
import { loadSettings, saveSettings } from '../src/lib/settings';

const readLocale = (id: string) => readFileSync(new URL('../src/locales/' + id + '.json', import.meta.url), 'utf8');
const variables = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('los catálogos no duplican claves y conservan las variables del español', () => {
  const base = JSON.parse(readLocale('es')) as Record<string, string>;
  for (const { id } of LANGUAGES) {
    const raw = readLocale(id);
    const [statement] = ts.parseJsonText(id + '.json', raw).statements;
    assert.ok(ts.isExpressionStatement(statement) && ts.isObjectLiteralExpression(statement.expression));
    const seen = new Set<string>();
    for (const entry of statement.expression.properties) {
      assert.ok(ts.isPropertyAssignment(entry) && ts.isStringLiteral(entry.name) && ts.isStringLiteral(entry.initializer));
      const key = entry.name.text;
      assert.ok(!seen.has(key), id + ': clave duplicada ' + key);
      seen.add(key);
      assert.ok(Object.hasOwn(base, key), id + ': clave desconocida ' + key);
      assert.ok(entry.initializer.text.trim(), id + ': traducción vacía de ' + key);
      assert.deepEqual(variables(entry.initializer.text), variables(base[key]), id + ': variables de ' + key);
    }
    assert.ok(seen.size > 0, id + ': catálogo vacío');
  }
});

test('usa el texto disponible o su respaldo en español e interpola datos sin modificarlos', () => {
  assert.equal(translate('agr', 'navigation.map'), 'Núgka dakumkámu');
  assert.equal(translate('cbt', 'emergency.enfermedad'), 'Kañu');
  assert.equal(translate('cni', 'biodiversity.title'), 'Osankenaitoki');
  assert.equal(translate('es', 'navigation.map'), 'Mapa');
  const values = { name: 'Juana {nombre}' };
  assert.equal(translate('cni', 'home.greeting', values), 'Kametsa pimpoke, Juana {nombre}');
  assert.equal(messageLanguage('cni', 'home.greeting'), 'cni');
  assert.equal(translate('cbt', 'home.greeting', values), 'Hola, Juana {nombre}');
  assert.equal(messageLanguage('cbt', 'home.greeting'), 'es');
});

test('las fechas conservan el formato en español y los tiempos usan el idioma activo', () => {
  const spanish: Translate = (key, values) => translate('es', key, values);
  const shawi: Translate = (key, values) => translate('cbt', key, values);
  const date = new Date(2026, 8, 3, 15, 5);
  const iso = date.toISOString();
  assert.equal(formatDateTime(iso, spanish), '03-set., 03:05 p. m.');
  assert.equal(formatRelative(iso, spanish, date.getTime() + 120_000), 'hace 2 minutos');
  assert.equal(formatRelative(iso, shawi, date.getTime() + 86_400_000), "i'wara");
  assert.equal(formatRelative(iso, shawi, date.getTime() - 86_400_000), 'tahshiraya');
});

test('la disponibilidad de cada idioma se calcula sobre el catálogo completo', () => {
  const keys = Object.keys(JSON.parse(readLocale('es')));
  const proposals = JSON.parse(readLocale('propuestas'));
  for (const { id } of LANGUAGES) {
    const catalog = { ...proposals[id], ...JSON.parse(readLocale(id)) } as Record<string, string>;
    assert.equal(isLanguageComplete(id), keys.every((key) => Boolean(catalog[key]?.trim())), id);
  }
});

test('las propuestas visibles conservan la interpolación y el original de los mensajes de envío', () => {
  const spanish = JSON.parse(readLocale('es')) as Record<string, string>;
  const proposals = JSON.parse(readLocale('propuestas'));
  for (const [id, catalog] of Object.entries(proposals)) {
    const review = JSON.parse(readFileSync(new URL('../../docs/i18n/borradores/' + id + '.json', import.meta.url), 'utf8'));
    for (const [key, proposal] of Object.entries(catalog as Record<string, string>)) {
      assert.ok(Object.hasOwn(spanish, key) && proposal.trim(), key);
      assert.equal(review[key].estado, 'borrador_ia', key);
      assert.equal(proposal, review[key].propuesta, key);
      assert.deepEqual(variables(proposal), variables(spanish[key]), key);
    }
  }
  assert.equal(translate('agr', 'navigation.home'), 'Nágkabau');
  assert.equal(translate('cni', 'community.fotoDe', { title: 'Canasta' }), 'Shiyakaantsi Canasta');
  assert.equal(translate('cni', 'sos.deseaEnviarUnaAlertaDeEmergencia'), spanish['sos.deseaEnviarUnaAlertaDeEmergencia']);
  assert.equal(translate('agr', 'sos.siEnviar'), spanish['sos.siEnviar']);
});

test('la beta muestra un solo rótulo por clave y conserva las variables', () => {
  const spanish = JSON.parse(readLocale('es')) as Record<string, string>;
  const visual: VisualCatalog = JSON.parse(readLocale('simulacion-visual'));
  for (const [language, entries] of Object.entries(visual)) {
    for (const [key, text] of Object.entries(entries)) {
      assert.ok(Object.hasOwn(spanish, key) && text.trim(), language + ' · ' + key);
      assert.deepEqual(variables(text), variables(spanish[key]), language + ' · ' + key);
      assert.ok(!text.startsWith(spanish[key] + ' · '), language + ' · ' + key);
    }
  }
  assert.equal(translate('cni', 'community.publicar'), 'Publicar');
  assert.equal(translate('cni', 'community.publicar', undefined, visual), 'Tsajotinpinki');
  assert.equal(translate('cni', 'community.category.hogar', undefined, visual), 'Pankotsi');
  assert.equal(translate('es', 'community.publicar', undefined, visual), 'Publicar');
  assert.equal(translate('agr', 'navigation.history', undefined, visual), 'Mina étsejmau aidau');
  assert.equal(translate('agr', 'home.pideAyudaSinEsperarSenal', undefined, visual), 'Pide yaimat sin esperar señal.');
  assert.equal(translate('cni', 'sos.deseaEnviarUnaAlertaDeEmergencia', undefined, visual),
    spanish['sos.deseaEnviarUnaAlertaDeEmergencia']);
  assert.equal(translate('cni', 'map.activarMiUbicacion', undefined, visual), spanish['map.activarMiUbicacion']);
  assert.equal(translate('cbt', 'common.no', undefined, visual), 'No');
});

test('el audio de prueba sigue la preferencia y conserva el guion original', () => {
  const guide = 'Elige qué está pasando.';
  assert.equal(guideText(guide, 'es', true), guide);
  assert.equal(guideText(guide, 'agr', false), guide);
  for (const [id, word] of [['agr', 'Yaimat'], ['cbt', "Ninanu'"], ['cni', 'Amitakotantsi']] as const) {
    const result = guideText(guide, id, true);
    assert.ok(result.includes(word), id);
    assert.ok(result.endsWith(guide), id);
    assert.doesNotMatch(result, /Ayuda:|Comunidad:/, id);
  }
});

test('la preferencia conserva los ajustes anteriores y acepta los códigos históricos', (context) => {
  const key = 'manguare.settings.v1';
  const entries = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (name: string) => entries.get(name) ?? null,
      setItem: (name: string, value: string) => entries.set(name, value),
    },
  });
  context.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  assert.equal(loadSettings().language, 'es');

  for (const [legacy, current] of [['aw', 'agr'], ['sh', 'cbt'], ['invalido', 'es']]) {
    entries.set(key, JSON.stringify({ language: legacy, community: 'Chiriaco', simulateOffline: true }));
    assert.equal(loadSettings().language, current);
    assert.equal(loadSettings().community, 'Chiriaco');
    assert.equal(loadSettings().simulateOffline, true);
  }

  for (const { id } of LANGUAGES) {
    saveSettings({ ...loadSettings(), language: id });
    assert.equal(loadSettings().language, id);
    assert.equal(loadSettings().community, 'Chiriaco');
  }
});

test('los textos JSX fijos de las pantallas se resuelven en los catálogos', () => {
  const src = new URL('../src/', import.meta.url);
  const technicalLabels = new Set(['Manguaré', 'devUT', 'GPS', 'SOS', 'm)', 'OpenStreetMap']);
  const textAttributes = new Set(['aria-label', 'alt', 'title', 'subtitle', 'placeholder']);
  for (const file of readdirSync(src, { recursive: true })) {
    if (!file.endsWith('.tsx')) continue;
    const source = ts.createSourceFile(file, readFileSync(new URL(file.replaceAll('\\', '/'), src), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      const raw = ts.isJsxText(node)
        ? node.getFullText().trim()
        : ts.isJsxAttribute(node) && textAttributes.has(node.name.getText()) && node.initializer && ts.isStringLiteral(node.initializer)
          ? node.initializer.text
          : '';
      if (/\p{L}/u.test(raw)) assert.ok(technicalLabels.has(raw), file + ': texto fuera del catálogo: ' + raw);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
