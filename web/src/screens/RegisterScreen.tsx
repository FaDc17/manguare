import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Camera, Check, UserRound } from 'lucide-react';
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
  Record<keyof RegistrationFields | 'pinConfirm' | 'dniFront' | 'dniBack', string>
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
      setErrors((current) => ({ ...current, [side]: 'Selecciona una imagen.' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({ ...current, [side]: 'La imagen debe pesar menos de 5 MB.' }));
      return;
    }
    const photo = { file, preview: URL.createObjectURL(file) };
    if (side === 'dniFront') setFront(photo);
    else setBack(photo);
    setErrors((current) => ({ ...current, [side]: undefined }));
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!fields.firstName.trim()) next.firstName = 'Escribe tu nombre.';
    if (!fields.lastName.trim()) next.lastName = 'Escribe tu apellido.';
    if (!/^9\d{8}$/.test(fields.phone)) next.phone = 'Usa 9 dígitos y empieza con 9.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.trim())) {
      next.email = 'Escribe un correo válido.';
    }
    if (!fields.department) next.department = 'Selecciona un departamento.';
    if (!fields.province) next.province = 'Selecciona una provincia.';
    if (!fields.district) next.district = 'Selecciona un distrito.';
    if (!fields.community.trim()) next.community = 'Escribe tu comunidad.';
    if (!fields.addressReference.trim()) next.addressReference = 'Escribe una referencia.';
    if (!/^\d{6}$/.test(fields.pin)) next.pin = 'El PIN debe tener 6 dígitos.';
    if (fields.pin !== pinConfirm) {
      next.pin = 'Los PIN no coinciden.';
      next.pinConfirm = 'Los PIN no coinciden.';
    }
    if (leader && !front) next.dniFront = 'Selecciona la foto frontal del DNI.';
    if (leader && !back) next.dniBack = 'Selecciona la foto posterior del DNI.';
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
      const message = error instanceof Error ? error.message : 'No se pudo crear la cuenta.';
      setErrors((current) => ({
        ...current,
        ...(message.toLowerCase().includes('correo') ? { email: message } : { phone: message }),
      }));
      setTermsOpen(false);
    }
  };

  if (completedSession) {
    return (
      <div className="login-page">
        <main className="login-card register-success">
          <span className="register-success-icon">
            <Check size={30} aria-hidden="true" />
          </span>
          <p className="login-eyebrow">Cuenta creada en este dispositivo</p>
          <h1>¡Bienvenido/a, {completedSession.name}!</h1>
          <p className="login-lead">
            {leader
              ? 'Tu solicitud de líder quedó registrada localmente para la demostración. No se verifica ni se envía a ningún servidor.'
              : 'Tu registro local está listo. Puedes ingresar con tu celular o correo y el PIN que elegiste.'}
          </p>
          {leader ? (
            <p className="register-local-note">
              La solicitud de liderazgo y las fotos del DNI son solo de demostración; no se envían
              ni se verifican.
            </p>
          ) : null}
          <button
            type="button"
            className="login-submit"
            data-testid="register-continue"
            onClick={() => onRegistered(completedSession)}
          >
            Continuar a DevUT
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="login-page">
      <main className="login-card register-card">
        <button type="button" className="register-back" onClick={onCancel}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver al ingreso
        </button>
        <p className="login-eyebrow">Únete a tu comunidad</p>
        <h1>Crear cuenta</h1>
        <p className="login-lead">El registro se guarda solo en este navegador/dispositivo.</p>

        <form className="register-form" onSubmit={openTerms} noValidate>
          <div className="register-fields-two">
            <label className="login-field">
              <span>Nombre</span>
              <input
                autoComplete="given-name"
                data-testid="register-first-name"
                value={fields.firstName}
                onChange={(event) => change('firstName', event.target.value)}
              />
              {errors.firstName ? <small className="field-error">{errors.firstName}</small> : null}
            </label>
            <label className="login-field">
              <span>Apellido</span>
              <input
                autoComplete="family-name"
                data-testid="register-last-name"
                value={fields.lastName}
                onChange={(event) => change('lastName', event.target.value)}
              />
              {errors.lastName ? <small className="field-error">{errors.lastName}</small> : null}
            </label>
          </div>

          <label className="login-field">
            <span>Celular</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              data-testid="register-phone"
              maxLength={9}
              placeholder="9 dígitos, empieza con 9"
              value={fields.phone}
              onChange={(event) => change('phone', event.target.value.replace(/\D/g, '').slice(0, 9))}
            />
            {errors.phone ? <small className="field-error">{errors.phone}</small> : null}
          </label>

          <label className="login-field">
            <span>Correo</span>
            <input
              type="email"
              autoComplete="email"
              data-testid="register-email"
              value={fields.email}
              onChange={(event) => change('email', event.target.value)}
            />
            {errors.email ? <small className="field-error">{errors.email}</small> : null}
          </label>

          <div className="register-fields-two">
            <label className="login-field">
              <span>Departamento</span>
              <select
                data-testid="register-department"
                value={fields.department}
                onChange={(event) => {
                  change('department', event.target.value);
                  change('province', '');
                  change('district', '');
                }}
              >
                <option value="">Selecciona</option>
                {COMMUNITY_DEPARTMENTS.map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
              {errors.department ? <small className="field-error">{errors.department}</small> : null}
            </label>
            <label className="login-field">
              <span>Provincia</span>
              <select
                data-testid="register-province"
                value={fields.province}
                disabled={!selectedDepartment}
                onChange={(event) => {
                  change('province', event.target.value);
                  change('district', '');
                }}
              >
                <option value="">Selecciona</option>
                {selectedDepartment?.provinces.map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
              {errors.province ? <small className="field-error">{errors.province}</small> : null}
            </label>
          </div>

          <label className="login-field">
            <span>Distrito</span>
            <select
              data-testid="register-district"
              value={fields.district}
              disabled={!selectedProvince}
              onChange={(event) => change('district', event.target.value)}
            >
              <option value="">Selecciona</option>
              {selectedProvince?.districts.map((district) => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
            {errors.district ? <small className="field-error">{errors.district}</small> : null}
          </label>

          <label className="login-field">
            <span>Comunidad</span>
            <input
              list="community-suggestions"
              data-testid="register-community"
              autoComplete="address-level3"
              value={fields.community}
              onChange={(event) => change('community', event.target.value)}
              onBlur={() => change('community', correctedCommunityName(fields.community))}
              placeholder="Ej. Awajún"
            />
            <datalist id="community-suggestions">
              {COMMUNITY_SUGGESTIONS.map((community) => (
                <option key={community} value={community} />
              ))}
            </datalist>
            {errors.community ? <small className="field-error">{errors.community}</small> : null}
          </label>

          <label className="login-field">
            <span>Referencia de dirección</span>
            <input
              autoComplete="street-address"
              data-testid="register-address"
              value={fields.addressReference}
              onChange={(event) => change('addressReference', event.target.value)}
              placeholder="Barrio, río o punto conocido"
            />
            {errors.addressReference ? (
              <small className="field-error">{errors.addressReference}</small>
            ) : null}
          </label>

          <div className="register-fields-two">
            <label className="login-field">
              <span>PIN de 6 dígitos</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                data-testid="register-pin"
                maxLength={6}
                value={fields.pin}
                onChange={(event) => change('pin', event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              {errors.pin ? <small className="field-error">{errors.pin}</small> : null}
            </label>
            <label className="login-field">
              <span>Confirmar PIN</span>
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
                <small className="field-error">{errors.pinConfirm}</small>
              ) : null}
            </label>
          </div>

          <fieldset className="register-leader">
            <legend>¿Eres líder de alguna comunidad?</legend>
            <div className="register-choice-row">
              <label>
                <input type="radio" name="leader" checked={!leader} onChange={() => setLeader(false)} />
                No
              </label>
              <label>
                <input
                  type="radio"
                  name="leader"
                  data-testid="register-leader-yes"
                  checked={leader}
                  onChange={() => setLeader(true)}
                />
                Sí
              </label>
            </div>
            {leader ? (
              <div className="register-documents">
                <p>Adjunta ambos lados del DNI para la demostración. No se validan ni se envían.</p>
                <div className="register-fields-two">
                  {([
                    ['dniFront', 'Frontal del DNI', front],
                    ['dniBack', 'Posterior del DNI', back],
                  ] as const).map(([side, label, photo]) => (
                    <label className="dni-upload" key={side}>
                      {photo ? (
                        <img src={photo.preview} alt={`Vista previa ${label}`} />
                      ) : (
                        <span className="dni-upload-placeholder">
                          <Camera size={22} aria-hidden="true" /> {label}
                        </span>
                      )}
                      <input
                        type="file"
                        data-testid={side === 'dniFront' ? 'register-dni-front' : 'register-dni-back'}
                        accept="image/*"
                        onChange={(event) => {
                          handleDocument(event.target.files?.[0], side);
                          event.target.value = '';
                        }}
                      />
                      {errors[side] ? <small className="field-error">{errors[side]}</small> : null}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </fieldset>

          <p className="register-local-note">
            El PIN y los datos del perfil se almacenan localmente para esta demostración. No uses
            información sensible real.
          </p>
          <button type="submit" className="login-submit" data-testid="register-submit">
            <UserRound size={18} aria-hidden="true" /> Crear cuenta
          </button>
        </form>
      </main>

      <Sheet
        open={termsOpen}
        title="Términos y protección de datos"
        onClose={() => setTermsOpen(false)}
        footer={
          <button
            type="button"
            className="btn btn-primary btn-block"
            data-testid="register-accept"
            onClick={completeRegistration}
          >
            Aceptar y crear cuenta
          </button>
        }
      >
        <p className="sheet-intro">
          Al aceptar, confirmas que leíste los términos de uso de DevUT y el aviso de la Ley de
          Protección de Datos Personales.
        </p>
        <div className="notice-box">
          <strong>Registro de demostración</strong>
          <p>
            Tu perfil se guarda únicamente en el almacenamiento local de este navegador. Las fotos
            del DNI son previsualizaciones temporales y no se guardan ni se envían.
          </p>
        </div>
      </Sheet>
    </div>
  );
}
