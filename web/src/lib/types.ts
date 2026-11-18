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

export interface AlertResponse {
  code: string;
  message?: string;
  at: string;
  by?: string;
}

export interface AlertRecord {
  id: string;
  type: EmergencyType;
  isSos?: boolean;
  note: string;
  community: string;
  deviceName: string;
  /** Nombre del perfil que reportó (acceso de demostración). */
  reportedBy?: string;
  /** Teléfono del perfil que reportó. */
  reporterPhone?: string;
  location?: AlertLocation;
  photo?: string;
  consentLocation: boolean;
  createdAt: string;
  updatedAt: string;
  state: AlertState;
  attempts: number;
  /** Token local para editar el detalle del SOS; el servidor guarda solo su hash. */
  editToken?: string;
  detailsPendingSync?: boolean;
  lastAttemptAt?: string;
  /** Marca de tiempo del próximo reintento automático (política de espera progresiva). */
  nextAttemptAt?: string;
  lastError?: string;
  serverReceivedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  /** Plazo para que la red confirme la alerta. */
  ackDeadlineAt?: string;
  escalatedAt?: string;
  responses?: AlertResponse[];
  smsOpenedAt?: string;
}

export interface AlertDraft {
  type: EmergencyType;
  isSos?: boolean;
  note: string;
  community: string;
  deviceName: string;
  reportedBy?: string;
  reporterPhone?: string;
  location?: AlertLocation;
  photo?: string;
  consentLocation: boolean;
}

/** Alert as stored by the server. */
export interface ServerAlert {
  id: string;
  type: EmergencyType;
  isSos?: boolean;
  note: string;
  community: string;
  deviceName: string;
  reportedBy?: string;
  reporterPhone?: string;
  location?: AlertLocation;
  photo?: string;
  consentLocation: boolean;
  clientCreatedAt: string;
  serverReceivedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  ackDeadlineAt?: string;
  escalatedAt?: string;
  escalationCount?: number;
  lastEscalationChannel?: string;
  responses?: AlertResponse[];
  events?: Array<{ type: string; at: string; by?: string; code?: string; channel?: string }>;
}

export interface SyncResult {
  sent: number;
  failed: number;
}

export const BIODIVERSITY_CATEGORIES = [
  'Tala ilegal',
  'Caza o pesca ilegal',
  'Contaminación de ríos',
  'Minería ilegal',
  'Incendios',
  'Otro',
] as const;

export type BiodiversityCategory = (typeof BIODIVERSITY_CATEGORIES)[number];
export type BiodiversityReportState = 'pending' | 'sent' | 'read';

export interface BiodiversityReport {
  id: string;
  category: BiodiversityCategory;
  title: string;
  description: string;
  photo?: string;
  location?: AlertLocation;
  community: string;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
  state: BiodiversityReportState;
  attempts: number;
  serverReceivedAt?: string;
  readAt?: string;
  lastError?: string;
}

export interface ServerBiodiversityReport
  extends Omit<BiodiversityReport, 'state' | 'attempts' | 'lastError' | 'updatedAt'> {
  state: 'sent' | 'read';
  serverReceivedAt: string;
  readAt?: string;
}

export type BiodiversityReportDraft = Omit<
  BiodiversityReport,
  'id' | 'createdAt' | 'updatedAt' | 'state' | 'attempts' | 'serverReceivedAt' | 'readAt' | 'lastError'
>;
