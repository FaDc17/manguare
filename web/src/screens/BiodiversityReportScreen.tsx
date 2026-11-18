import { useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ImagePlus, Leaf, LoaderCircle, MapPin, Send, X } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { useSession } from '../app/SessionContext';
import { AsyncLocationPicker } from '../components/AsyncLocationPicker';
import { SubHeader } from '../components/SubHeader';
import { compressImage } from '../lib/photo';
import { BIODIVERSITY_CATEGORIES, type AlertLocation, type BiodiversityCategory } from '../lib/types';

export function BiodiversityReportScreen({
  category,
  onCancel,
}: {
  category?: BiodiversityCategory;
  onCancel: () => void;
}) {
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
      setError(reason instanceof Error ? reason.message : 'No se pudo procesar la foto.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Completa el título y la descripción.');
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
          ? 'Reporte guardado. Se enviará al recuperar conexión.'
          : 'Reporte enviado a la API de biodiversidad.',
        created.state === 'pending' ? 'warn' : 'ok',
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el reporte.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedId) {
    const state = report?.state ?? 'pending';
    const label = state === 'read' ? 'Leída' : state === 'sent' ? 'Enviada' : 'Pendiente';
    return (
      <div className="screen biodiversity-screen">
        <SubHeader title="Estado del reporte" onBack={onCancel} />
        <section className={`report-status-card report-status-${state}`}>
          <span className="report-status-icon"><Leaf size={24} aria-hidden="true" /></span>
          <div className="report-status-copy">
            <p className="eyebrow">Alerta Amazonía</p>
            <h1 data-testid="biodiversity-state">{label}</h1>
            <strong>{title}</strong>
            <p>
              {state === 'pending'
                ? 'Está guardado en este teléfono y se enviará al volver la conexión.'
                : state === 'read'
                  ? 'El reporte fue marcado como leído por el panel que consume la API.'
                  : 'El servidor de biodiversidad ya recibió este reporte.'}
            </p>
          </div>
        </section>
        <p className="report-integration-note">
          Este reporte usa una API separada (`/api/biodiversity`). El panel externo todavía debe
          integrarse a esa API para listarlo y marcarlo como leído.
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={onCancel}>
          Volver a Conecta Amazonía
        </button>
      </div>
    );
  }

  return (
    <div className="screen biodiversity-screen">
      <SubHeader title="Reporte de biodiversidad" onBack={onCancel} />
      <form className="biodiversity-form" onSubmit={(event) => void submit(event)}>
        <p className="eyebrow"><span className="eyebrow-dot" /> Alerta Amazonía</p>
        <h1>Cuéntanos qué observaste</h1>
        <p className="screen-lead">
          El reporte se guarda aparte de las emergencias y no aparecerá en el mapa público.
        </p>

        <label className="field">
          <span className="field-label">Categoría</span>
          <select
            data-testid="biodiversity-category"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value as BiodiversityCategory)}
          >
            {BIODIVERSITY_CATEGORIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Título</span>
          <input
            data-testid="biodiversity-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej. Tala cerca de la quebrada"
            maxLength={120}
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Descripción</span>
          <textarea
            data-testid="biodiversity-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe qué observaste y una referencia segura."
            rows={4}
            maxLength={2000}
            required
          />
        </label>

        <div className="field">
          <span className="field-label">Foto (opcional)</span>
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
              <img src={photo} alt="Vista previa del reporte" />
              <button type="button" className="photo-remove" onClick={() => setPhoto(undefined)} aria-label="Quitar foto">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button type="button" className="photo-add" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
              {photoBusy ? <LoaderCircle size={22} className="spin" /> : <ImagePlus size={22} />}
              <span>{photoBusy ? 'Preparando foto…' : 'Adjuntar una imagen'}</span>
            </button>
          )}
        </div>

        <div className="field">
          <span className="field-label"><MapPin size={15} aria-hidden="true" /> Ubicación aproximada (opcional)</span>
          <AsyncLocationPicker value={location} onChange={setLocation} />
          {location ? (
            <button type="button" className="text-btn" onClick={() => setLocation(undefined)}>
              Quitar ubicación
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
          {submitting ? 'Guardando…' : 'Enviar reporte'}
        </button>
        <p className="report-integration-note">
          Por ahora el servidor guarda el reporte en una API independiente; la visualización en el
          panel requiere conectar ese panel a `/api/biodiversity`.
        </p>
        <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
          <ArrowLeft size={17} /> Cancelar
        </button>
      </form>
    </div>
  );
}
