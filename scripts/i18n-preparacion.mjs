// Exporta las claves con contexto y verifica las propuestas y sus variables.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const sourceDir = new URL('web/src/', root);
const output = new URL('docs/i18n/', root);
const languages = ['agr', 'cbt', 'cni'];
const update = process.argv.includes('--actualizar');
const status = {
  verified: 'verificada_documental',
  draft: 'borrador_ia',
  pending: 'pendiente',
};
const sections = {
  alertCard: 'Tarjeta del historial y de alertas recientes',
  alertDetail: 'Detalle, seguimiento y confirmaciones de una alerta',
  audioButton: 'Controles de la guía de audio',
  biodiversity: 'Formulario e historial de reportes ambientales',
  common: 'Rótulo reutilizado en pantallas y controles',
  community: 'Comunidad, categorías y publicaciones de demostración',
  connectionPill: 'Indicador de conectividad',
  document: 'Título de la pestaña del navegador',
  emergency: 'Tipos y descripciones breves de emergencias',
  helpSheet: 'Contactos y números de ayuda',
  history: 'Historial y filtros de alertas y reportes',
  home: 'Inicio, botón de emergencia y accesos rápidos',
  image: 'Errores al preparar imágenes adjuntas',
  language: 'Selector de idiomas y avisos de disponibilidad',
  location: 'Datos de la ubicación en formularios',
  locationPicker: 'Captura y consentimiento de ubicación',
  login: 'Ingreso y validación de PIN',
  map: 'Mapa, búsqueda y geolocalización',
  navigation: 'Barra de navegación principal',
  newAlert: 'Asistente para crear y enviar una alerta',
  panel: 'Panel de la red de salud e ingreso del personal',
  registration: 'Formulario, validación y confirmación de registro',
  response: 'Indicaciones de la red de salud',
  role: 'Rol de la cuenta',
  settings: 'Ajustes de teléfono, cuenta, idioma y conectividad',
  sos: 'Confirmación y envío de una alerta SOS',
  status: 'Nombres y descripciones de estados de alerta',
  sync: 'Avisos de sincronización y envío',
  time: 'Fechas, horas y tiempos relativos',
  topBar: 'Encabezado, marca y acceso al selector',
};
const criticalGroups = new Set([
  'alertCard', 'alertDetail', 'connectionPill', 'emergency', 'helpSheet', 'history', 'location',
  'locationPicker', 'login', 'map', 'newAlert', 'panel', 'registration', 'response', 'sos', 'status', 'sync',
]);
const batches = [
  ['navigation', 'common', 'home', 'topBar', 'language', 'audioButton', 'document', 'connectionPill', 'role'],
  ['community', 'map', 'location', 'locationPicker'],
  ['biodiversity', 'history', 'image', 'helpSheet'],
  ['login', 'registration'],
  ['settings', 'status', 'sync'],
  ['newAlert', 'emergency', 'sos'],
  ['alertDetail', 'alertCard'],
  ['panel', 'response'],
  ['time'],
];

function readObject(url) {
  const path = fileURLToPath(url);
  const raw = readFileSync(url, 'utf8');
  const entries = ts.parseJsonText(path, raw).statements[0]?.expression?.properties;
  assert.ok(entries, 'Se esperaba un objeto JSON en ' + path);
  const seen = new Set();
  for (const entry of entries) {
    assert.ok(ts.isPropertyAssignment(entry) && ts.isStringLiteral(entry.name), path);
    assert.ok(!seen.has(entry.name.text), 'Clave duplicada en ' + path + ' · ' + entry.name.text);
    seen.add(entry.name.text);
  }
  return JSON.parse(raw);
}

const loadLocale = (id) => readObject(new URL('locales/' + id + '.json', sourceDir));
const spanish = loadLocale('es');
const keys = Object.keys(spanish);
const references = new Map(keys.map((key) => [key, new Set()]));
for (const file of readdirSync(sourceDir, { recursive: true })) {
  if (!/\.tsx?$/.test(file)) continue;
  const relative = file.replaceAll('\\', '/');
  const lines = readFileSync(new URL(relative, sourceDir), 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const reference = `web/src/${relative}:${index + 1}`;
    for (const match of line.matchAll(/['"]([A-Za-z]\w*(?:\.\w+)+)['"]|`([A-Za-z]\w*(?:\.\w+)*\.)\$\{/g)) {
      if (match[1]) references.get(match[1])?.add(reference);
      else for (const key of keys.filter((key) => key.startsWith(match[2]))) references.get(key).add(reference);
    }
  });
}

const documentation = readFileSync(new URL('docs/IDIOMAS.md', root), 'utf8');
const documentedSources = new Map();
for (const row of documentation.split(/\r?\n/)) {
  const match = /^\| `(agr|cbt|cni)` · (.+?) \|/.exec(row);
  if (!match) continue;
  const urls = [...row.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map((link) => link[1]);
  for (const mention of match[2].matchAll(/`([^\x60]+)`/g)) {
    documentedSources.set(match[1] + ':' + mention[1], urls);
  }
}

function placeholders(text) {
  return [...text.matchAll(/\{\w+\}/g)].map(([name]) => name);
}

const ordered = batches.flatMap((groups) => keys.filter((key) => groups.includes(key.split('.')[0])));
assert.deepEqual([...ordered].sort(), [...keys].sort(), 'La lista temática debe cubrir todo el catálogo');
const batchSize = 82;
const catalog = Object.fromEntries(ordered.map((key, index) => {
  const group = key.split('.')[0];
  assert.ok(sections[group], 'Contexto sin asignar para ' + key);
  return [key, {
    texto: spanish[key],
    contexto: sections[group],
    referencias: [...references.get(key)],
    variables: placeholders(spanish[key]),
    lote: Math.floor(index / batchSize) + 1,
    requiereRevisionCritica: criticalGroups.has(group) ||
      /(?:ubicacion|gps|borrarAlertas|salud|emergencia|sincron|cerrarSesion)/i.test(key),
  }];
}));

function save(url, payload) {
  const current = existsSync(url) ? readObject(url) : null;
  if (!update) assert.deepEqual(current, payload, 'Catálogo de preparación desactualizado · ' + fileURLToPath(url));
  else if (JSON.stringify(current) !== JSON.stringify(payload)) {
    mkdirSync(new URL('./', url), { recursive: true });
    writeFileSync(url, JSON.stringify(payload, null, 2) + '\n');
  }
}

const inventory = {};
for (const language of languages) {
  const active = loadLocale(language);
  const url = new URL('borradores/' + language + '.json', output);
  const saved = existsSync(url) ? readObject(url) : {};
  const entries = {};
  const totals = Object.fromEntries(Object.values(status).map((value) => [value, 0]));
  for (const [key, source] of Object.entries(catalog)) {
    const previous = saved[key];
    const verified = Object.hasOwn(active, key);
    if (previous?.estado === status.draft) {
      assert.equal(previous.original, source.texto, 'Revisar el borrador tras cambiar el original · ' + language + ':' + key);
    }
    const proposal = verified ? active[key] : previous?.propuesta ?? null;
    const state = verified ? status.verified : proposal === null ? status.pending : status.draft;
    const sources = verified
      ? documentedSources.get(language + ':' + key) ?? []
      : previous?.fuentes ?? [];
    const notes = verified
      ? 'Equivalencia documentada en el catálogo activo. Revisar su uso local en la interfaz.'
      : previous?.observaciones ?? (source.requiereRevisionCritica
        ? 'Falta una propuesta sustentada. Revisar la interpretación en el flujo correspondiente con un hablante.'
        : 'Falta evidencia suficiente para proponer el texto completo en este contexto.');
    const confidence = verified ? 'documental' : state === status.draft ? previous?.confianza : null;
    if (proposal !== null) {
      assert.ok(typeof proposal === 'string' && proposal.trim(), language + ':' + key);
      assert.deepEqual(placeholders(proposal).sort(), [...source.variables].sort(), 'Variables incompatibles · ' + language + ':' + key);
      assert.equal((proposal.match(/\n/g) ?? []).length, (source.texto.match(/\n/g) ?? []).length, 'Saltos de línea incompatibles · ' + language + ':' + key);
      const identifiers = /\b(?:PIN|DNI|SMS|SOS|GPS|SAMU|HTTP|Manguaré|DevUT|OpenStreetMap)\b/gu;
      assert.deepEqual(
        [...proposal.matchAll(identifiers)].map(([identifier]) => identifier).sort(),
        [...source.texto.matchAll(identifiers)].map(([identifier]) => identifier).sort(),
        'Identificadores incompatibles · ' + language + ':' + key,
      );
      assert.ok(sources.length && sources.every((source) => source.startsWith('https://')), 'Falta la fuente · ' + language + ':' + key);
    }
    if (state === status.draft) {
      assert.ok(['baja', 'media'].includes(confidence) && notes.trim(), 'Faltan datos de revisión · ' + language + ':' + key);
    }
    entries[key] = {
      original: source.texto,
      propuesta: proposal,
      idioma: language,
      estado: state,
      confianza: confidence,
      fuentes: sources,
      observaciones: notes,
      revisionHumana: true,
      lote: source.lote,
    };
    totals[state]++;
  }
  inventory[language] = totals;
  save(url, entries);
}
save(new URL('catalogo-espanol.json', output), catalog);
console.log(JSON.stringify({ claves: keys.length, lotes: Math.ceil(keys.length / batchSize), idiomas: inventory }, null, 2));
