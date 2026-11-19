// Mantiene el formulario y sus mensajes de validación al cambiar de idioma.

import { LocalizedText, useTranslation } from '../i18n/LanguageContext';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Camera, Check, UserRound } from 'lucide-react';
import { LanguageSelect } from '../components/LanguageSelect';
import { InterfaceError, type MessageKey } from '../i18n/catalog';
import { Sheet } from '../components/Sheet';
import {
  COMMUNITY_DEPARTMENTS,
  COMMUNITY_SUGGESTIONS,
  correctedCommunityName,
} from '../lib/geography';
import { loadSettings, saveSettings } from '../lib/settings';
import { registerLocalAccount, type LocalAccount, type Session } from '../lib/session';

type RegistrationFields = Omit<LocalAccount, 'name' | 'leaderVerificationPending'> & {
  firstName: string;
  lastName: string;
};

type FieldErrors = Partial<
  Record<keyof RegistrationFields | 'pinConfirm' | 'dniFront' | 'dniBack', MessageKey>
>;

interface DocumentPhoto {
  file: File;
  preview: string;
}

const EMPTY_FIELDS: RegistrationFields = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  pin: '',
  community: '',
  department: '',
  province: '',
  district: '',
  addressReference: '',
};

export function RegisterScreen({
  onCancel,
  onRegistered,
}: {
  onCancel: () => void;
  onRegistered: (session: Session) => void;
}) {
  const { t } = useTranslation();
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [leader, setLeader] = useState(false);
  const [pinConfirm, setPinConfirm] = useState('');
  const [front, setFront] = useState<DocumentPhoto | null>(null);
  const [back, setBack] = useState<DocumentPhoto | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [completedSession, setCompletedSession] = useState<Session | null>(null);

  const selectedDepartment = useMemo(
    () => COMMUNITY_DEPARTMENTS.find((item) => item.name === fields.department),
    [fields.department],
  );
  const selectedProvince = useMemo(
    () => selectedDepartment?.provinces.find((item) => item.name === fields.province),
    [selectedDepartment, fields.province],
  );

  useEffect(() => {
    return () => {
      if (front) URL.revokeObjectURL(front.preview);
      if (back) URL.revokeObjectURL(back.preview);
    };
  }, [front, back]);

  const change = (key: keyof RegistrationFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleDocument = (
    file: File | undefined,
    side: 'dniFront' | 'dniBack',
  ) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((current) => ({ ...current, [side]: 'registration.seleccionaUnaImagen' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({ ...current, [side]: 'registration.laImagenDebePesarMenosDe' }));
      return;
    }
    const photo = { file, preview: URL.createObjectURL(file) };
    if (side === 'dniFront') setFront(photo);
    else setBack(photo);
    setErrors((current) => ({ ...current, [side]: undefined }));
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!fields.firstName.trim()) next.firstName = 'registration.escribeTuNombre';
    if (!fields.lastName.trim()) next.lastName = 'registration.escribeTuApellido';
    if (!/^9\d{8}$/.test(fields.phone)) next.phone = 'registration.usa9DigitosYEmpiezaCon';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.trim())) {
      next.email = 'registration.escribeUnCorreoValido';
    }
    if (!fields.department) next.department = 'registration.seleccionaUnDepartamento';
    if (!fields.province) next.province = 'registration.seleccionaUnaProvincia';
    if (!fields.district) next.district = 'registration.seleccionaUnDistrito';
    if (!fields.community.trim()) next.community = 'registration.escribeTuComunidad';
    if (!fields.addressReference.trim()) next.addressReference = 'registration.escribeUnaReferencia';
    if (!/^\d{6}$/.test(fields.pin)) next.pin = 'registration.elPinDebeTener6Digitos';
    if (fields.pin !== pinConfirm) {
      next.pin = 'registration.losPinNoCoinciden';
      next.pinConfirm = 'registration.losPinNoCoinciden';
    }
    if (leader && !front) next.dniFront = 'registration.seleccionaLaFotoFrontalDelDni';
    if (leader && !back) next.dniBack = 'registration.seleccionaLaFotoPosteriorDelDni';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const openTerms = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validate()) setTermsOpen(true);
  };

  const completeRegistration = () => {
    const account: LocalAccount = {
      phone: fields.phone,
      email: fields.email.trim().toLowerCase(),
      pin: fields.pin,
      name: `${fields.firstName.trim()} ${fields.lastName.trim()}`,
      community: correctedCommunityName(fields.community),
      department: fields.department,
      province: fields.province,
      district: fields.district,
      addressReference: fields.addressReference.trim(),
      leaderVerificationPending: leader,
    };
    try {
      const session = registerLocalAccount(account);
      saveSettings({ ...loadSettings(), community: account.community });
      setCompletedSession(session);
      setTermsOpen(false);
    } catch (error) {
      const key = error instanceof InterfaceError ? error.key : 'registration.noSePudoCrearLaCuenta';
      const field = key === 'registration.emailAlreadyRegistered' ? 'email' : 'phone';
      setErrors((current) => ({ ...current, [field]: key }));
      setTermsOpen(false);
    }
  };

  if (completedSession) {
    return (
      <div className="login-page">
        <main className="login-card register-success">
          <LanguageSelect />
          <span className="register-success-icon">
            <Check size={30} aria-hidden="true" />
          </span>
          <p className="login-eyebrow">{t('registration.cuentaCreadaEnEsteDispositivo')}</p>
          <h1>{t('registration.welcome', { name: completedSession.name })}</h1>
          <p className="login-lead">
            {leader
              ? t('registration.tuRegistroSeHaCompletadoEn')
              : t('registration.tuRegistroLocalEstaListoPuedes')}
          </p>
          {leader ? (
            <p className="register-local-note">
              {t('registration.laSolicitudDeLiderazgoYLas')}
            </p>
          ) : null}
          <button
            type="button"
            className="login-submit"
            data-testid="register-continue"
            onClick={() => onRegistered(completedSession)}
          >
            {t('registration.continuarADevut')}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="login-page">
      <main className="login-card register-card">
        <LanguageSelect />
        <button type="button" className="register-back" onClick={onCancel}>
          <ArrowLeft size={18} aria-hidden="true" />{' '}{t('registration.volverAlIngreso')}
        </button>
        <p className="login-eyebrow">{t('registration.uneteATuComunidad')}</p>
        <h1>{t('registration.crearCuenta')}</h1>
        <p className="login-lead">{t('registration.elRegistroSeGuardaSoloEn')}</p>

        <form className="register-form" onSubmit={openTerms} noValidate>
          <div className="register-fields-two">
            <label className="login-field">
              <span><LocalizedText id="registration.firstName" /></span>
              <input
                autoComplete="given-name"
                data-testid="register-first-name"
                value={fields.firstName}
                onChange={(event) => change('firstName', event.target.value)}
              />
              {errors.firstName ? <small className="field-error">{t(errors.firstName)}</small> : null}
            </label>
            <label className="login-field">
              <span>{t('registration.apellido')}</span>
              <input
                autoComplete="family-name"
                data-testid="register-last-name"
                value={fields.lastName}
                onChange={(event) => change('lastName', event.target.value)}
              />
              {errors.lastName ? <small className="field-error">{t(errors.lastName)}</small> : null}
            </label>
          </div>

          <label className="login-field">
            <span>{t('registration.celular')}</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              data-testid="register-phone"
              maxLength={9}
              placeholder={t('registration.9DigitosEmpiezaCon9')}
              value={fields.phone}
              onChange={(event) => change('phone', event.target.value.replace(/\D/g, '').slice(0, 9))}
            />
            {errors.phone ? <small className="field-error">{t(errors.phone)}</small> : null}
          </label>

          <label className="login-field">
            <span>{t('registration.correo')}</span>
            <input
              type="email"
              autoComplete="email"
              data-testid="register-email"
              value={fields.email}
              onChange={(event) => change('email', event.target.value)}
            />
            {errors.email ? <small className="field-error">{t(errors.email)}</small> : null}
          </label>

          <div className="register-fields-two">
            <label className="login-field">
              <span>{t('registration.departamento')}</span>
              <select
                data-testid="register-department"
                value={fields.department}
                onChange={(event) => {
                  change('department', event.target.value);
                  change('province', '');
                  change('district', '');
                }}
              >
                <option value="">{t('registration.selecciona')}</option>
                {COMMUNITY_DEPARTMENTS.map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
              {errors.department ? <small className="field-error">{t(errors.department)}</small> : null}
            </label>
            <label className="login-field">
              <span>{t('registration.provincia')}</span>
              <select
                data-testid="register-province"
                value={fields.province}
                disabled={!selectedDepartment}
                onChange={(event) => {
                  change('province', event.target.value);
                  change('district', '');
                }}
              >
                <option value="">{t('registration.selecciona')}</option>
                {selectedDepartment?.provinces.map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
              {errors.province ? <small className="field-error">{t(errors.province)}</small> : null}
            </label>
          </div>

          <label className="login-field">
            <span>{t('registration.distrito')}</span>
            <select
              data-testid="register-district"
              value={fields.district}
              disabled={!selectedProvince}
              onChange={(event) => change('district', event.target.value)}
            >
              <option value="">{t('registration.selecciona')}</option>
              {selectedProvince?.districts.map((district) => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
            {errors.district ? <small className="field-error">{t(errors.district)}</small> : null}
          </label>

          <label className="login-field">
              <span><LocalizedText id="location.community" /></span>
            <input
              list="community-suggestions"
              data-testid="register-community"
              autoComplete="address-level3"
              value={fields.community}
              onChange={(event) => change('community', event.target.value)}
              onBlur={() => change('community', correctedCommunityName(fields.community))}
              placeholder={t('registration.ejAwajun')}
            />
            <datalist id="community-suggestions">
              {COMMUNITY_SUGGESTIONS.map((community) => (
                <option key={community} value={community} />
              ))}
            </datalist>
            {errors.community ? <small className="field-error">{t(errors.community)}</small> : null}
          </label>

          <label className="login-field">
            <span>{t('registration.referenciaDeDireccion')}</span>
            <input
              autoComplete="street-address"
              data-testid="register-address"
              value={fields.addressReference}
              onChange={(event) => change('addressReference', event.target.value)}
              placeholder={t('registration.barrioRioOPuntoConocido')}
            />
            {errors.addressReference ? (
              <small className="field-error">{t(errors.addressReference)}</small>
            ) : null}
          </label>

          <div className="register-fields-two">
            <label className="login-field">
              <span>{t('registration.pinDe6Digitos')}</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                data-testid="register-pin"
                maxLength={6}
                value={fields.pin}
                onChange={(event) => change('pin', event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              {errors.pin ? <small className="field-error">{t(errors.pin)}</small> : null}
            </label>
            <label className="login-field">
              <span>{t('registration.confirmarPin')}</span>
              <input
                id="register-pin-confirm"
                data-testid="register-pin-confirm"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={pinConfirm}
                onChange={(event) => {
                  setPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 6));
                  setErrors((current) => ({ ...current, pinConfirm: undefined }));
                }}
              />
              {errors.pinConfirm ? (
                <small className="field-error">{t(errors.pinConfirm)}</small>
              ) : null}
            </label>
          </div>

          <fieldset className="register-leader">
            <legend>{t('registration.eresLiderDeAlgunaComunidad')}</legend>
            <div className="register-choice-row">
              <label>
                <input type="radio" name="leader" checked={!leader} onChange={() => setLeader(false)} />
                {t('common.no')}
              </label>
              <label>
                <input
                  type="radio"
                  name="leader"
                  data-testid="register-leader-yes"
                  checked={leader}
                  onChange={() => setLeader(true)}
                />
                {t('common.yes')}
              </label>
            </div>
            {leader ? (
              <div className="register-documents">
                <p>{t('registration.adjuntaAmbosLadosDelDniPara')}</p>
                <div className="register-fields-two">
                  {([
                    ['dniFront', t('registration.frontalDelDni'), front],
                    ['dniBack', t('registration.posteriorDelDni'), back],
                  ] as const).map(([side, label, photo]) => (
                    <label className="dni-upload" key={side}>
                      {photo ? (
                        <img src={photo.preview} alt={t('registration.vistaPrevia', { label })} />
                      ) : (
                        <span className="dni-upload-placeholder">
                          <Camera size={22} aria-hidden="true" /> {label}
                        </span>
                      )}
                      <input
                        type="file"
                        className="visually-hidden"
                        aria-label={label}
                        data-testid={side === 'dniFront' ? 'register-dni-front' : 'register-dni-back'}
                        accept="image/*"
                        onChange={(event) => {
                          handleDocument(event.target.files?.[0], side);
                          event.target.value = '';
                        }}
                      />
                      {errors[side] ? <small className="field-error">{t(errors[side])}</small> : null}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </fieldset>

          <p className="register-local-note">
            {t('registration.elPinYLosDatosDel')}
          </p>
          <button type="submit" className="login-submit" data-testid="register-submit">
            <UserRound size={18} aria-hidden="true" />{' '}{t('registration.crearCuenta')}
          </button>
        </form>
      </main>

      <Sheet
        open={termsOpen}
        title={t('registration.terminosYProteccionDeDatos')}
        onClose={() => setTermsOpen(false)}
        footer={
          <button
            type="button"
            className="btn btn-primary btn-block"
            data-testid="register-accept"
            onClick={completeRegistration}
          >
            {t('registration.aceptarYCrearCuenta')}
          </button>
        }
      >
        <p className="sheet-intro">
          {t('registration.alAceptarConfirmasQueLeisteLos')}
        </p>
        <div className="notice-box">
          <strong>{t('registration.registroDeDemostracion')}</strong>
          <p>
            {t('registration.tuPerfilSeGuardaUnicamenteEn')}
          </p>
        </div>
      </Sheet>
    </div>
  );
}
