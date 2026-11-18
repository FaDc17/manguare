import type { LucideIcon } from 'lucide-react';
import { Apple, House, Shirt, Truck, Wrench } from 'lucide-react';

export interface CommunityCategory {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const COMMUNITY_CATEGORIES: CommunityCategory[] = [
  { id: 'transporte', label: 'Transporte', icon: Truck },
  { id: 'vestimenta', label: 'Vestimenta', icon: Shirt },
  { id: 'hogar', label: 'Hogar', icon: House },
  { id: 'alimentos', label: 'Productos alimenticios', icon: Apple },
  { id: 'otros', label: 'Otros', icon: Wrench },
];

export interface CommunityListing {
  id: string;
  category: string;
  title: string;
  description: string;
  location: string;
  rating: number;
}

/** Datos de demostración tomados del prototipo de Figma. */
export const COMMUNITY_LISTINGS: CommunityListing[] = [
  {
    id: 'miel-comunidad',
    category: 'alimentos',
    title: 'Miel pura de la comunidad',
    description: 'Miel artesanal cosechada en nuestra comunidad.',
    location: 'Chiriaco, Imaza',
    rating: 4.9,
  },
  {
    id: 'transporte-carlos',
    category: 'transporte',
    title: 'Transporte fluvial Carlos',
    description: 'Viajes seguros por el río Marañón.',
    location: 'Santa María de Nieva',
    rating: 4.7,
  },
];

export interface SupportCenter {
  id: string;
  name: string;
  distance: string;
  note: string;
}

/** Distancias de demostración; no son una ubicación real de la comunidad. */
export const SUPPORT_CENTERS: SupportCenter[] = [
  {
    id: 'hospital-santa-maria',
    name: 'Hospital Santa María',
    distance: '2.1 km',
    note: 'Atención general',
  },
  {
    id: 'posta-imaza',
    name: 'Posta de salud Imaza',
    distance: '3.2 km',
    note: 'Atención general',
  },
  {
    id: 'centro-chiriaco',
    name: 'Centro de salud Chiriaco',
    distance: '4.3 km',
    note: 'Atención general',
  },
];

export const ENVIRONMENT_TOPICS = [
  'Tala ilegal',
  'Caza o pesca ilegal',
  'Contaminación de ríos',
  'Minería ilegal',
  'Incendios',
  'Otro',
] as const;
