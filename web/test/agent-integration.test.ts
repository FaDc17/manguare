import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AGENT_CAPABILITIES, listAgentCapabilities } from '../src/lib/agent-capabilities.ts';
import { translate } from '../src/i18n/catalog.ts';
import { emergencyMapPlaces, filterMapPlaces, groupMapPlacesByPixels, MAP_PLACES, placeDistanceKm } from '../src/lib/map-data.ts';
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
  const all = { emergency: false, conecta: true, support: true };

  it('busca hospitales en los mismos marcadores que dibuja el mapa', () => {
    const found = filterMapPlaces(MAP_PLACES, 'hospitales', all, t);
    assert.deepEqual(found.map((item) => item.id), ['hospital-santa-maria']);
    assert.ok(found.every((item) => item.demo));
  });

  it('respeta filtros activos y calcula distancia solo con coordenadas recibidas', () => {
    assert.deepEqual(filterMapPlaces(MAP_PLACES, 'hospital', {
      emergency: false, conecta: true, support: false,
    }, t), []);
    const hospital = MAP_PLACES.find((item) => item.id === 'hospital-santa-maria');
    assert.ok(hospital);
    assert.equal(placeDistanceKm(hospital, hospital.coordinates), 0);
  });

  it('incluye en el mapa solo emergencias con consentimiento y coordenadas válidas', () => {
    const alert = {
      id: 'alerta-1',
      type: 'accidente' as const,
      isSos: true,
      community: 'Nueva Esperanza',
      consentLocation: true,
      location: { lat: -4.7, lng: -78.15, accuracy: 5, capturedAt: '2026-01-01T00:00:00Z' },
      clientCreatedAt: '2026-01-01T00:00:00Z',
    };
    const places = emergencyMapPlaces([
      alert,
      { ...alert, id: 'sin-consentimiento', consentLocation: false },
      { ...alert, id: 'coordenadas-invalidas', location: { ...alert.location, lat: 91 } },
    ], t);

    assert.deepEqual(places.map((place) => place.id), ['emergency:alerta-1']);
    assert.equal(places[0].kind, 'emergency');
    assert.equal(places[0].demo, false);
    assert.equal(places[0].coordinates.lat, -4.7);
    assert.equal(places[0].name, t('sos.title'));
    assert.equal(places[0].description, '');
    assert.deepEqual(filterMapPlaces(places, '', {
      emergency: true, conecta: false, support: false,
    }, t), places);
  });

  it('conserva todas las emergencias cuando comparten un marcador', () => {
    const alert = {
      id: 'alerta-1', type: 'mordedura' as const, community: 'Awajun',
      consentLocation: true,
      location: { lat: -12.0, lng: -77.0, accuracy: 5, capturedAt: '2026-01-01T00:00:00Z' },
      clientCreatedAt: '2026-01-01T00:00:00Z',
    };
    const places = emergencyMapPlaces([
      alert,
      { ...alert, id: 'alerta-2', type: 'accidente' as const },
      { ...alert, id: 'alerta-3', location: { ...alert.location, lat: -11.99 } },
    ], t);
    const grouped = groupMapPlacesByPixels(places,
      ({ lat, lng }) => ({ x: lng * 100, y: lat * 100 }));
    assert.deepEqual(grouped.map((group) => group.map((place) => place.id)), [
      ['emergency:alerta-1', 'emergency:alerta-2', 'emergency:alerta-3'],
    ]);
    const zoomed = groupMapPlacesByPixels(places,
      ({ lat, lng }) => ({ x: lng * 10000, y: lat * 10000 }));
    assert.deepEqual(zoomed.map((group) => group.map((place) => place.id)), [
      ['emergency:alerta-1', 'emergency:alerta-2'],
      ['emergency:alerta-3'],
    ]);
  });
});
