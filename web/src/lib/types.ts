export const EMERGENCY_TYPES = [
  'enfermedad',
  'accidente',
  'mordedura',
  'parto',
  'otro',
] as const;

export type EmergencyType = (typeof EMERGENCY_TYPES)[number];

export type AlertState = 'pending' | 'sent' | 'received' | 'canceled';

export interface AlertLocation {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
}

export interface AlertRecord {
  id: string;
  type: EmergencyType;
  note: string;
  community: string;
  deviceName: string;
  location?: AlertLocation;
  photo?: string;
  consentLocation: boolean;
  createdAt: string;
  updatedAt: string;
  state: AlertState;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  serverReceivedAt?: string;
  acknowledgedAt?: string;
  smsOpenedAt?: string;
}

export interface AlertDraft {
  type: EmergencyType;
  note: string;
  community: string;
  deviceName: string;
  location?: AlertLocation;
  photo?: string;
  consentLocation: boolean;
}

/** Alert as stored by the server. */
export interface ServerAlert {
  id: string;
  type: EmergencyType;
  note: string;
  community: string;
  deviceName: string;
  location?: AlertLocation;
  photo?: string;
  consentLocation: boolean;
  clientCreatedAt: string;
  serverReceivedAt: string;
  acknowledgedAt?: string;
}

export interface SyncResult {
  sent: number;
  failed: number;
}
