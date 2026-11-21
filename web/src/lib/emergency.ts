import {
  Baby,
  Bug,
  Bandage,
  CircleHelp,
  HeartPulse,
  type LucideIcon,
} from 'lucide-react';
import type { EmergencyType } from './types';

// Guarda una nota SOS estable que las pantallas pueden traducir al mostrarla.
export const SOS_DEFAULT_NOTE = 'Alerta SOS';

export interface EmergencyMeta {
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: 'red' | 'amber' | 'green' | 'teal' | 'stone';
  audioLabel: string;
}

export const EMERGENCY_META: Record<EmergencyType, EmergencyMeta> = {
  enfermedad: {
    label: 'Enfermedad',
    hint: 'Fiebre, dolor fuerte o desmayo',
    icon: HeartPulse,
    tone: 'red',
    audioLabel: 'Enfermedad',
  },
  accidente: {
    label: 'Accidente',
    hint: 'Caída, golpe o herida',
    icon: Bandage,
    tone: 'amber',
    audioLabel: 'Accidente',
  },
  mordedura: {
    label: 'Mordedura',
    hint: 'Serpiente, araña u otro animal',
    icon: Bug,
    tone: 'green',
    audioLabel: 'Mordedura',
  },
  parto: {
    label: 'Parto',
    hint: 'Nacimiento o complicación',
    icon: Baby,
    tone: 'teal',
    audioLabel: 'Parto',
  },
  otro: {
    label: 'Otro',
    hint: 'Otra urgencia o peligro',
    icon: CircleHelp,
    tone: 'stone',
    audioLabel: 'Otro',
  },
};
