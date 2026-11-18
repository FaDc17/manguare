/**
 * Acceso de demostración del prototipo.
 *
 * No es autenticación real: las credenciales viven en el cliente y solo sirven
 * para mostrar los dos perfiles del Figma (usuario y administrador). El panel
 * de la red de salud sí tiene su propia contraseña en el servidor.
 */
export type SessionRole = 'user' | 'admin';

export interface Session {
  phone: string;
  name: string;
  role: SessionRole;
  loggedAt: string;
}

export interface DemoAccount {
  phone: string;
  pin: string;
  name: string;
  role: SessionRole;
  label: string;
  description: string;
}

export const DEMO_PIN = '123456';

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    phone: '992066275',
    pin: DEMO_PIN,
    name: 'Juan',
    role: 'user',
    label: 'Usuario',
    description: 'Miembro de la comunidad',
  },
  {
    phone: '987654321',
    pin: DEMO_PIN,
    name: 'Admin',
    role: 'admin',
    label: 'Admin',
    description: 'Red de salud y panel',
  },
];

const STORAGE_KEY = 'manguare.session.v1';

export function normalizePhone(value: string): string {
  return value.replace(/[^\d]/g, '').slice(0, 15);
}

function toLocalPhone(value: string): string {
  const digits = normalizePhone(value);
  return digits.length === 11 && digits.startsWith('51') ? digits.slice(2) : digits;
}

export function formatPhone(value: string): string {
  const digits = normalizePhone(value);
  if (digits.length === 11 && digits.startsWith('51')) {
    const local = digits.slice(2);
    return `+51 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return digits;
}

export function roleLabel(role: SessionRole): string {
  return role === 'admin' ? 'Administrador de la red' : 'Miembro de la comunidad';
}

export function authenticate(phone: string, pin: string): Session | null {
  const cleanPhone = toLocalPhone(phone);
  const account = DEMO_ACCOUNTS.find(
    (item) => item.phone === cleanPhone && item.pin === pin,
  );
  if (!account) return null;
  return {
    phone: account.phone,
    name: account.name,
    role: account.role,
    loggedAt: new Date().toISOString(),
  };
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (
      typeof parsed.phone !== 'string' ||
      typeof parsed.name !== 'string' ||
      (parsed.role !== 'user' && parsed.role !== 'admin')
    ) {
      return null;
    }
    return {
      phone: parsed.phone,
      name: parsed.name,
      role: parsed.role,
      loggedAt: typeof parsed.loggedAt === 'string' ? parsed.loggedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Sin almacenamiento la sesión dura lo que dure la pestaña.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que limpiar.
  }
}
