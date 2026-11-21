// Traduce el formulario ambiental y mantiene los códigos de sus categorías.

import { LocalizedText, useTranslation } from '../i18n/LanguageContext';
import { InterfaceError } from '../i18n/catalog';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ImagePlus, Leaf, LoaderCircle, MapPin, Send, X } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { useSession } from '../app/SessionContext';
import { AsyncLocationPicker } from '../components/AsyncLocationPicker';
import { SubHeader } from '../components/SubHeader';
import { compressImage } from '../lib/photo';
import { biodiversityLabels } from '../i18n/labels';
import { BIODIVERSITY_CATEGORIES, type AlertLocation, type BiodiversityCategory } from '../lib/types';

export function BiodiversityReportScreen({
  category,
  onCancel,
}: {
  category?: BiodiversityCategory;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { biodiversityReports, createBiodiversityReport, settings, showToast } = useApp();
  const { session } = useSession();
  const [selectedCategory, setSelectedCategory] = useState<BiodiversityCategory>(
    category ?? 'Tala ilegal',
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<AlertLocation>();
  const [photo, setPhoto] = useState<string>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string>();
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const report = useMemo(
    () => biodiversityReports.find((item) => item.id === submittedId),
    [biodiversityReports, submittedId],
  );

  const handlePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      setPhoto(await compressImage(file));
      setError('');
    } catch (reason) {
      setError(t(reason instanceof InterfaceError ? reason.key : 'biodiversity.noSePudoProcesarLaFoto'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError(t('biodiversity.completaElTituloYLaDescripcion'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const created = await createBiodiversityReport({
        category: selectedCategory,
        title: title.trim(),
        description: description.trim(),
        photo,
        location,
        community: settings.community,
        reportedBy: session.name,
      });
      setSubmittedId(created.id);
      showToast(
        created.state === 'pending'
          ? t('biodiversity.reporteGuardadoSeEnviaraAlRecuperar')
          : t('biodiversity.reporteEnviadoALaApiDe'),
        created.state === 'pending' ? 'warn' : 'ok',
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('biodiversity.noSePudoGuardarElReporte'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedId) {
    const state = report?.state ?? 'pending';
    const label = state === 'read' ? t('status.read') : state === 'sent' ? t('status.sent') : t('status.pending');
    return (
      <div className="screen biodiversity-screen">
        <SubHeader title={t('biodiversity.estadoDelReporte')} onBack={onCancel} />
        <section className={`report-status-card report-status-${state}`}>
          <span className="report-status-icon"><Leaf size={24} aria-hidden="true" /></span>
          <div className="report-status-copy">
            <p className="eyebrow">{t('biodiversity.alertaAmazonia')}</p>
            <h1 data-testid="biodiversity-state">{label}</h1>
            <strong>{title}</strong>
            <p>
              {state === 'pending'
                ? t('biodiversity.estaGuardadoEnEsteTelefonoY')
                : state === 'read'
                  ? t('biodiversity.elReporteFueMarcadoComoLeido')
                  : t('biodiversity.elServidorDeBiodiversidadYaRecibio')}
            </p>
          </div>
        </section>
        <p className="report-integration-note">
          {t('biodiversity.esteReporteUsaUnaApiSeparada')}
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={onCancel}>
          {t('biodiversity.volverAConectaAmazonia')}
        </button>
      </div>
    );
  }

  return (
    <div className="screen biodiversity-screen">
      <SubHeader title={t('biodiversity.reporteDeBiodiversidad')} onBack={onCancel} />
      <form className="biodiversity-form" onSubmit={(event) => void submit(event)}>
        <p className="eyebrow"><span className="eyebrow-dot" />{' '}{t('biodiversity.alertaAmazonia')}</p>
        <h1>{t('biodiversity.cuentanosQueObservaste')}</h1>
        <p className="screen-lead">
          {t('biodiversity.elReporteSeGuardaAparteDe')}
        </p>

        <label className="field">
          <span className="field-label">{t('biodiversity.categoria')}</span>
          <select
            data-testid="biodiversity-category"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value as BiodiversityCategory)}
          >
            {BIODIVERSITY_CATEGORIES.map((item) => (
              <option key={item} value={item}>{t(biodiversityLabels[item])}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label"><LocalizedText id="biodiversity.title" /></span>
          <input
            data-testid="biodiversity-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('biodiversity.ejTalaCercaDeLaQuebrada')}
            maxLength={120}
            required
          />
        </label>

        <label className="field">
          <span className="field-label">{t('biodiversity.descripcion')}</span>
          <textarea
            data-testid="biodiversity-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('biodiversity.describeQueObservasteYUnaReferencia')}
            rows={4}
            maxLength={2000}
            required
          />
        </label>

        <div className="field">
          <span className="field-label">{t('biodiversity.fotoOpcional')}</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void handlePhoto(file);
            }}
          />
          {photo ? (
            <div className="photo-preview">
              <img src={photo} alt={t('biodiversity.vistaPreviaDelReporte')} />
              <button type="button" className="photo-remove" onClick={() => setPhoto(undefined)} aria-label={t('biodiversity.quitarFoto')}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button type="button" className="photo-add" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
              {photoBusy ? <LoaderCircle size={22} className="spin" /> : <ImagePlus size={22} />}
              <span>{photoBusy ? t('biodiversity.preparandoFoto') : t('biodiversity.adjuntarUnaImagen')}</span>
            </button>
          )}
        </div>

        <div className="field">
          <span className="field-label"><MapPin size={15} aria-hidden="true" />{' '}{t('biodiversity.ubicacionAproximadaOpcional')}</span>
          <AsyncLocationPicker value={location} onChange={setLocation} />
          {location ? (
            <button type="button" className="text-btn" onClick={() => setLocation(undefined)}>
              {t('biodiversity.quitarUbicacion')}
            </button>
          ) : null}
        </div>

        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block"
          data-testid="biodiversity-submit"
          disabled={submitting || photoBusy}
        >
          {submitting ? <LoaderCircle size={19} className="spin" /> : <Send size={19} />}
          {submitting ? t('biodiversity.guardando') : t('biodiversity.enviarReporte')}
        </button>
        <p className="report-integration-note">
          {t('biodiversity.porAhoraElServidorGuardaEl')}
        </p>
        <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
          <ArrowLeft size={17} />{' '}{t('common.cancel')}
        </button>
      </form>
    </div>
  );
}
