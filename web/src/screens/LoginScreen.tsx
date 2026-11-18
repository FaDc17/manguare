import { useMemo, useState } from 'react';
import { ArrowRight, Delete, ShieldCheck, UserRound } from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import {
  authenticate,
  DEMO_ACCOUNTS,
  DEMO_PIN,
  formatPhone,
  normalizePhone,
  type Session,
} from '../lib/session';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export function LoginScreen({
  onLogin,
  onRegister,
}: {
  onLogin: (session: Session) => void;
  onRegister: () => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = useMemo(
    () =>
      (normalizePhone(identifier).length === 9 ||
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(identifier.trim())) &&
      pin.length === 6,
    [identifier, pin],
  );

  const addDigit = (digit: string) => {
    setError(null);
    setPin((current) => (current.length >= 6 ? current : current + digit));
  };

  const erase = () => {
    setError(null);
    setPin((current) => current.slice(0, -1));
  };

  const fillDemo = (demoPhone: string) => {
    setIdentifier(demoPhone);
    setPin(DEMO_PIN);
    setError(null);
    setNotice(null);
  };

  const submit = () => {
    const session = authenticate(identifier, pin);
    if (!session) {
      setError('Número o PIN incorrecto. Usa uno de los accesos de demo.');
      setPin('');
      return;
    }
    onLogin(session);
  };

  return (
    <div className="login-page">
      <div className="login-glow" aria-hidden="true" />
      <main className="login-card">
        <div className="login-brand">
          <BrandMark size={56} />
          <div>
            <strong>Manguaré</strong>
            <span>DevUT · comunidad amazónica</span>
          </div>
        </div>

        <p className="login-eyebrow">Bienvenido a tu comunidad</p>
        <h1>Ingresa a DevUT</h1>
        <p className="login-lead">Conecta, pide ayuda y cuida la Amazonía.</p>

        <label className="login-field">
          <span>Correo o celular</span>
          <span className="login-phone">
            <UserRound size={17} aria-hidden="true" />
            <input
              type="text"
              inputMode="text"
              autoComplete="username"
              data-testid="login-phone"
              placeholder="Ej. 992 066 275"
              value={identifier}
              onChange={(event) => {
                setError(null);
                const value = event.target.value.slice(0, 100);
                setIdentifier(value.includes('@') ? value : normalizePhone(value));
              }}
            />
          </span>
        </label>

        <div className="login-pin-head">
          <span>PIN de 6 dígitos</span>
          <div className="login-dots" aria-label={`${pin.length} de 6 dígitos`}>
            {Array.from({ length: 6 }, (_, index) => (
              <i key={index} className={index < pin.length ? 'is-filled' : ''} />
            ))}
          </div>
        </div>

        <div className="login-keypad" role="group" aria-label="Teclado numérico del PIN">
          {KEYS.map((digit) => (
            <button
              key={digit}
              type="button"
              data-testid={`login-key-${digit}`}
              onClick={() => addDigit(digit)}
            >
              {digit}
            </button>
          ))}
          <button type="button" className="login-erase" onClick={erase} aria-label="Borrar un dígito">
            <Delete size={17} aria-hidden="true" /> Borrar
          </button>
        </div>

        {error ? (
          <p className="login-error" role="alert" data-testid="login-error">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="login-submit"
          data-testid="login-submit"
          onClick={submit}
          disabled={!canSubmit}
        >
          Ingresar <ArrowRight size={19} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="login-link"
          onClick={() =>
            setNotice('En este prototipo el PIN es 123456 para los dos accesos de demo.')
          }
        >
          ¿Olvidaste tu PIN?
        </button>

        {notice ? <p className="login-notice">{notice}</p> : null}

        <div className="demo-access">
          <strong>Accesos de demo</strong>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.phone}
              type="button"
              className="demo-access-row"
              data-testid={`demo-${account.role}`}
              onClick={() => fillDemo(account.phone)}
            >
              <span>
                <b>{account.label}</b> · {formatPhone(account.phone)}
              </span>
              <span>{account.description}</span>
            </button>
          ))}
          <span className="demo-access-pin">PIN para ambos: {DEMO_PIN}</span>
        </div>

        <p className="login-register">
          ¿Aún no tienes una cuenta?{' '}
          <button
            type="button"
            data-testid="register-link"
            onClick={onRegister}
          >
            Regístrate
          </button>
        </p>

        <p className="login-foot">
          <ShieldCheck size={15} aria-hidden="true" />
          Acceso de demostración. No uses este PIN en un piloto real.
        </p>
      </main>
    </div>
  );
}
