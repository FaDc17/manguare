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
  email?: string;
  community?: string;
  leaderVerificationPending?: boolean;
}

export interface DemoAccount {
  phone: string;
  pin: string;
  name: string;
  role: SessionRole;
  label: string;
  description: string;
}

export interface LocalAccount {
  phone: string;
  email: string;
  pin: string;
  name: string;
  community: string;
  department: string;
  province: string;
  district: string;
  addressReference: string;
  leaderVerificationPending: boolean;
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
const ACCOUNTS_STORAGE_KEY = 'manguare.local-accounts.v1';

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

export function loadLocalAccounts(): LocalAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (account): account is LocalAccount =>
        account !== null &&
        typeof account === 'object' &&
        'phone' in account &&
        'email' in account &&
        'pin' in account &&
        'name' in account &&
        typeof account.phone === 'string' &&
        typeof account.email === 'string' &&
        typeof account.pin === 'string' &&
        typeof account.name === 'string',
    );
  } catch {
    return [];
  }
}

export function registerLocalAccount(account: LocalAccount): Session {
  const accounts = loadLocalAccounts();
  if (accounts.some((saved) => saved.phone === account.phone)) {
    throw new Error('Ese celular ya está registrado en este dispositivo.');
  }
  if (accounts.some((saved) => saved.email.toLowerCase() === account.email.toLowerCase())) {
    throw new Error('Ese correo ya está registrado en este dispositivo.');
  }
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify([...accounts, account]));
  } catch {
    throw new Error('No se pudo guardar la cuenta en este dispositivo.');
  }
  return {
    phone: account.phone,
    name: account.name,
    role: 'user',
    loggedAt: new Date().toISOString(),
    email: account.email,
    community: account.community,
    leaderVerificationPending: account.leaderVerificationPending,
  };
}

export function authenticate(identifier: string, pin: string): Session | null {
  const cleanIdentifier = identifier.trim().toLowerCase();
  const cleanPhone = toLocalPhone(identifier);
  const account = DEMO_ACCOUNTS.find(
    (item) => item.phone === cleanPhone && item.pin === pin,
  );
  if (account) {
    return {
      phone: account.phone,
      name: account.name,
      role: account.role,
      loggedAt: new Date().toISOString(),
    };
  }
  const localAccount = loadLocalAccounts().find(
    (item) =>
      item.pin === pin &&
      (toLocalPhone(identifier) === item.phone ||
        (cleanIdentifier.includes('@') && cleanIdentifier === item.email.toLowerCase())),
  );
  if (!localAccount) return null;
  return {
    phone: localAccount.phone,
    name: localAccount.name,
    role: 'user',
    loggedAt: new Date().toISOString(),
    email: localAccount.email,
    community: localAccount.community,
    leaderVerificationPending: localAccount.leaderVerificationPending,
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
      ...(typeof parsed.email === 'string' ? { email: parsed.email } : {}),
      ...(typeof parsed.community === 'string' ? { community: parsed.community } : {}),
      ...(typeof parsed.leaderVerificationPending === 'boolean'
        ? { leaderVerificationPending: parsed.leaderVerificationPending }
        : {}),
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
