import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isExplicitPublicationConfirmation,
  listingDistanceKm,
  canReadAdminEmergencies,
  searchCommunityListings,
  summarizeVoiceListing,
  validateVoiceListing,
  voiceCapabilities,
  voiceListingFieldSchema,
  type ListingFormValues,
} from '../src/lib/voice-tools.ts';
import { COMMUNITY_LISTINGS } from '../src/lib/community.ts';

describe('flujo de publicación por voz', () => {
  const complete: ListingFormValues = {
    title: 'Mochila tejida',
    category: 'vestimenta',
    price: 'S/ 50',
    location: 'GPS: -5.15, -78.29',
    description: 'Mochila hecha a mano',
  };

  it('expone campos y opciones del formulario, con foto opcional', () => {
    const schema = voiceListingFieldSchema();
    assert.equal(schema.title.required, true);
    assert.equal(schema.description.required, true);
    assert.equal(schema.photo.required, false);
    assert.ok(schema.category.options.some((option) => option.id === 'vestimenta'));
  });

  it('marca los datos incompletos sin sustituirlos por valores inventados', () => {
    const validation = validateVoiceListing({ ...complete, price: '', description: '' });
    assert.deepEqual(validation.missing, ['price', 'description']);
    assert.equal(validation.valid, false);
  });

  it('resume solo los valores capturados y advierte si comparte GPS exacto', () => {
    const summary = summarizeVoiceListing({
      ...complete,
      coordinates: { lat: -5.15, lng: -78.29, accuracy: 18 },
    });
    assert.ok(summary.includes('Mochila tejida'));
    assert.ok(summary.includes('GPS exactas: -5.15, -78.29'));
    assert.ok(summary.includes('precisión aproximada 18 m'));
    assert.ok(!summary.includes('A convenir'));
    assert.ok(!summary.includes('Sin descripción'));
  });

  it('acepta confirmación explícita y rechaza cancelación o cambios pendientes', () => {
    assert.equal(isExplicitPublicationConfirmation('Sí, publica la mochila.'), true);
    assert.equal(isExplicitPublicationConfirmation('De acuerdo, hazlo por favor.'), true);
    assert.equal(isExplicitPublicationConfirmation('No, cancela.'), false);
    assert.equal(isExplicitPublicationConfirmation('Sí, pero cambia el precio.'), false);
    assert.equal(isExplicitPublicationConfirmation('Tal vez.'), false);
  });
});

describe('lectura de la app por voz', () => {
  it('encuentra publicaciones por producto sin distinguir tildes', () => {
    const results = searchCommunityListings(COMMUNITY_LISTINGS, 'platano');
    assert.ok(results.some((item) => item.id === 'yuca-elena'));
    assert.ok(!results.some((item) => item.id === 'miel-comunidad'));
    assert.deepEqual(searchCommunityListings(COMMUNITY_LISTINGS, '¿Hay alguien vendiendo plátano cerca de mí?')
      .map((item) => item.id), ['yuca-elena']);
  });

  it('limita "cerca de mí" a coordenadas reales y 30 km', () => {
    const point = { lat: -5.2, lng: -78.31 };
    const results = searchCommunityListings(COMMUNITY_LISTINGS, 'plátano', point);
    assert.deepEqual(results.map((item) => item.id), ['yuca-elena']);
    assert.equal(listingDistanceKm(results[0]!, point), 0);
    assert.deepEqual(searchCommunityListings(COMMUNITY_LISTINGS, 'plátano', { lat: -12.05, lng: -77.04 }), []);
  });

  it('limita búsquedas a una localidad cuando se especifica', () => {
    assert.deepEqual(searchCommunityListings(COMMUNITY_LISTINGS, 'plátano', null, 'Imaza').map((item) => item.id), ['yuca-elena']);
    assert.deepEqual(searchCommunityListings(COMMUNITY_LISTINGS, 'plátano', null, 'Nieva'), []);
  });

  it('solo ofrece las emergencias de la red al administrador', () => {
    assert.ok(!voiceCapabilities('user').includes('consultar_emergencias_del_panel_con_sesion_autenticada'));
    assert.ok(voiceCapabilities('admin').includes('consultar_emergencias_del_panel_con_sesion_autenticada'));
    assert.ok(!voiceCapabilities('admin', true).includes('consultar_emergencias_del_panel_con_sesion_autenticada'));
    assert.equal(canReadAdminEmergencies('user', true), false);
    assert.equal(canReadAdminEmergencies('admin', false), false);
    assert.equal(canReadAdminEmergencies('admin', true), true);
  });
});
