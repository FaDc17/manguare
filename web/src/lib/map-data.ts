import { communityLabel } from '../i18n/labels';
import { translate, type MessageKey, type Translate } from '../i18n/catalog';
import { COMMUNITY_LISTINGS, SUPPORT_CENTERS } from './community';
import type { AlertLocation } from './types';
import { normalizeSearch } from './voice-tools';

export type MapKind = 'conecta' | 'support';
export type MapFilters = Record<MapKind, boolean>;

export interface MapPlace {
  id: string;
  kind: MapKind;
  name: string;
  category: MessageKey;
  description: string;
  location: string;
  coordinates: { lat: number; lng: number };
  demo: true;
}

export interface MapVoiceController {
  getSnapshot(): {
    search: string;
    filters: MapFilters;
    selectedId: string | null;
    userLocation?: AlertLocation;
    visiblePlaces: MapPlace[];
  };
  searchPlaces(query: string): void;
  selectPlace(id: string): boolean;
}

/** Misma fuente que dibuja los marcadores; por ahora son datos de demostración. */
export const MAP_PLACES: MapPlace[] = [
  ...COMMUNITY_LISTINGS.filter(
    (listing): listing is typeof listing & { coordinates: { lat: number; lng: number } } =>
      Boolean(listing.coordinates),
  ).map((listing) => ({
    id: listing.id,
    kind: 'conecta' as const,
    name: listing.title,
    category: communityLabel(listing.category, 'map.conecta'),
    description: listing.description,
    location: listing.location,
    coordinates: listing.coordinates,
    demo: true as const,
  })),
  ...SUPPORT_CENTERS.map((center) => ({
    id: center.id,
    kind: 'support' as const,
    name: center.name,
    category: 'map.centroDeApoyo' as const,
    description: center.note,
    location: center.distance,
    coordinates: center.coordinates,
    demo: true as const,
  })),
];

export function filterMapPlaces(
  places: MapPlace[],
  search: string,
  filters: MapFilters,
  t: Translate,
): MapPlace[] {
  const query = normalizeSearch(search);
  const singular = query.endsWith('es') && query.length > 5 ? query.slice(0, -2)
    : query.endsWith('s') && query.length > 5 ? query.slice(0, -1) : query;
  return places.filter((place) => {
    if (!filters[place.kind]) return false;
    if (!query) return true;
    return [place.name, t(place.category), translate('es', place.category), place.location]
      .some((part) => {
        const value = normalizeSearch(part);
        return value.includes(query) || value.includes(singular);
      });
  });
}

export function placeDistanceKm(place: MapPlace, point: { lat: number; lng: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(place.coordinates.lat - point.lat);
  const dLng = radians(place.coordinates.lng - point.lng);
  const arc = Math.sin(dLat / 2) ** 2 + Math.cos(radians(point.lat)) *
    Math.cos(radians(place.coordinates.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}
