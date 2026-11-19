// Permite elegir el idioma antes de iniciar sesión y traduce los avisos del PIN.

import { useTranslation } from '../i18n/LanguageContext';
import { useMemo, useState } from 'react';
import { ArrowRight, Delete, ShieldCheck, UserRound } from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { LanguageSelect } from '../components/LanguageSelect';
import type { MessageKey } from '../i18n/catalog';
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
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [notice, setNotice] = useState<MessageKey | null>(null);

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
      setError('login.numeroOPinIncorrectoUsaUno');
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
            <span>{t('login.devutComunidadAmazonica')}</span>
          </div>
        </div>

        <LanguageSelect />

        <p className="login-eyebrow">{t('login.bienvenidoATuComunidad')}</p>
        <h1>{t('login.ingresaADevut')}</h1>
        <p className="login-lead">{t('login.conectaPideAyudaYCuidaLa')}</p>

        <label className="login-field">
          <span>{t('login.correoOCelular')}</span>
          <span className="login-phone">
            <UserRound size={17} aria-hidden="true" />
            <input
              type="text"
              inputMode="text"
              autoComplete="username"
              data-testid="login-phone"
              placeholder={t('login.ej992066275')}
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
          <span>{t('login.pinDe6Digitos')}</span>
          <div className="login-dots" aria-label={t('login.de6Digitos', { count: pin.length })}>
            {Array.from({ length: 6 }, (_, index) => (
              <i key={index} className={index < pin.length ? 'is-filled' : ''} />
            ))}
          </div>
        </div>

        <div className="login-keypad" role="group" aria-label={t('login.tecladoNumericoDelPin')}>
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
          <button type="button" className="login-erase" onClick={erase} aria-label={t('login.borrarUnDigito')}>
            <Delete size={17} aria-hidden="true" />{' '}{t('login.borrar')}
          </button>
        </div>

        {error ? (
          <p className="login-error" role="alert" data-testid="login-error">
            {t(error)}
          </p>
        ) : null}

        <button
          type="button"
          className="login-submit"
          data-testid="login-submit"
          onClick={submit}
          disabled={!canSubmit}
        >
          {t('login.ingresar')}{' '}<ArrowRight size={19} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="login-link"
          onClick={() =>
            setNotice('login.enEstePrototipoElPinEs')
          }
        >
          {t('login.olvidasteTuPin')}
        </button>

        {notice ? <p className="login-notice">{t(notice)}</p> : null}

        <div className="demo-access">
          <strong>{t('login.accesosDeDemo')}</strong>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.phone}
              type="button"
              className="demo-access-row"
              data-testid={`demo-${account.role}`}
              onClick={() => fillDemo(account.phone)}
            >
              <span>
                <b>{t(account.role === 'admin' ? 'settings.admin' : 'settings.usuario')}</b> · {formatPhone(account.phone)}
              </span>
              <span>{t(account.role === 'admin' ? 'login.adminDescription' : 'role.user')}</span>
            </button>
          ))}
          <span className="demo-access-pin">{t('login.pinParaAmbos')}{' '}{DEMO_PIN}</span>
        </div>

        <p className="login-register">
          {t('login.aunNoTienesUnaCuenta')}{' '}
          <button
            type="button"
            data-testid="register-link"
            onClick={onRegister}
          >
            {t('login.registrate')}
          </button>
        </p>

        <p className="login-foot">
          <ShieldCheck size={15} aria-hidden="true" />
          {t('login.accesoDeDemostracionNoUsesEste')}
        </p>
      </main>
    </div>
  );
}
