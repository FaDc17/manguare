import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AGENT_CAPABILITIES, listAgentCapabilities } from '../src/lib/agent-capabilities.ts';
import { translate } from '../src/i18n/catalog.ts';
import { filterMapPlaces, MAP_PLACES, placeDistanceKm } from '../src/lib/map-data.ts';
import { hasExplicitLanguageIntent, hasExplicitLocationIntent, VOICE_FUNCTION_DECLARATIONS } from '../src/lib/voice-tools.ts';

describe('registro de herramientas del agente', () => {
  it('solo anuncia herramientas declaradas y cubre los módulos principales', () => {
    const names = new Set(VOICE_FUNCTION_DECLARATIONS.map((tool) => tool.name));
    for (const module of AGENT_CAPABILITIES) {
      for (const name of [...module.readTools, ...module.actionTools]) {
        assert.ok(names.has(name), `${module.id}: ${name}`);
      }
    }
    assert.deepEqual(new Set(AGENT_CAPABILITIES.map((module) => module.id)), new Set([
      'inicio', 'emergencias', 'biodiversidad', 'comunidad', 'red', 'mapa',
      'idiomas', 'ajustes', 'ayuda', 'panel',
    ]));
  });

  it('no ofrece el panel sin rol y sesión web pertinentes', () => {
    const user = listAgentCapabilities('user', false, true);
    const nativeAdmin = listAgentCapabilities('admin', true, true);
    const offlineAdmin = listAgentCapabilities('admin', false, false);
    assert.equal(user.find((item) => item.id === 'panel')?.available, false);
    assert.equal(nativeAdmin.find((item) => item.id === 'panel')?.available, false);
    assert.equal(offlineAdmin.find((item) => item.id === 'panel')?.available, false);
    assert.equal(listAgentCapabilities('admin', false, true).find((item) => item.id === 'panel')?.available, true);
  });

  it('reconoce peticiones explícitas antes de usar GPS o cambiar idioma', () => {
    assert.equal(hasExplicitLocationIntent('¿Qué hospitales hay cerca de mí?'), true);
    assert.equal(hasExplicitLocationIntent('¿Qué hospitales hay en el mapa?'), false);
    assert.equal(hasExplicitLanguageIntent('Cambia el idioma a awajún'), true);
    assert.equal(hasExplicitLanguageIntent('¿Qué idiomas hay?'), false);
  });
});

describe('fuente compartida del mapa', () => {
  const t = (key: Parameters<typeof translate>[1]) => translate('es', key);
  const all = { conecta: true, support: true };

  it('busca hospitales en los mismos marcadores que dibuja el mapa', () => {
    const found = filterMapPlaces(MAP_PLACES, 'hospitales', all, t);
    assert.deepEqual(found.map((item) => item.id), ['hospital-santa-maria']);
    assert.ok(found.every((item) => item.demo));
  });

  it('respeta filtros activos y calcula distancia solo con coordenadas recibidas', () => {
    assert.deepEqual(filterMapPlaces(MAP_PLACES, 'hospital', { conecta: true, support: false }, t), []);
    const hospital = MAP_PLACES.find((item) => item.id === 'hospital-santa-maria');
    assert.ok(hospital);
    assert.equal(placeDistanceKm(hospital, hospital.coordinates), 0);
  });
});
