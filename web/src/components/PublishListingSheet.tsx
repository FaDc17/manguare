import { Camera, ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useSession } from '../app/SessionContext';
import { COMMUNITY_CATEGORIES, type CommunityListing } from '../lib/community';
import { compressImage } from '../lib/photo';
import { buildListing } from '../lib/social';
import { Sheet } from './Sheet';

export function PublishListingSheet({
  open,
  onClose,
  onPublish,
}: {
  open: boolean;
  onClose: () => void;
  onPublish: (listing: CommunityListing) => void;
}) {
  const { session } = useSession();
  const { showToast } = useApp();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('alimentos');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle('');
    setCategory('alimentos');
    setPrice('');
    setLocation('');
    setDescription('');
    setPhoto(undefined);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      setPhoto(await compressImage(file, { maxSide: 900, maxChars: 160_000 }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo usar la foto.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const listing = buildListing({
      title,
      category,
      description,
      priceRange: price,
      location,
      author: session.name,
      photo,
    });
    if (!listing) {
      showToast('Escribe un título para tu publicación.', 'warn');
      return;
    }
    onPublish(listing);
    reset();
  };

  return (
    <Sheet
      open={open}
      title="Publicar mi producto o servicio"
      onClose={close}
      footer={
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy || !title.trim()}
          data-testid="listing-publish"
          onClick={submit}
        >
          Publicar
        </button>
      }
    >
      <div className="net-listing-form">
        <div className="field">
          <label className="field-label" htmlFor="listing-title">
            Título
          </label>
          <input
            id="listing-title"
            type="text"
            maxLength={80}
            value={title}
            placeholder="Ej.: Miel pura de abeja"
            data-testid="listing-title"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="listing-category">
            Categoría
          </label>
          <select
            id="listing-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {COMMUNITY_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="listing-price">
            Precio
          </label>
          <input
            id="listing-price"
            type="text"
            maxLength={30}
            value={price}
            placeholder="Ej.: S/ 20 – 30"
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="listing-location">
            ¿Dónde te encuentran?
          </label>
          <input
            id="listing-location"
            type="text"
            maxLength={80}
            value={location}
            placeholder="Ej.: Chiriaco, Imaza"
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="listing-description">
            Descripción
          </label>
          <textarea
            id="listing-description"
            rows={3}
            maxLength={400}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        {photo ? (
          <div className="net-photo-preview">
            <img src={photo} alt="Vista previa de la foto del producto" />
            <button
              type="button"
              className="icon-btn"
              aria-label="Quitar foto"
              onClick={() => setPhoto(undefined)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                void pickPhoto(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-block"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? (
                <Camera size={18} aria-hidden="true" />
              ) : (
                <ImagePlus size={18} aria-hidden="true" />
              )}{' '}
              {busy ? 'Procesando…' : 'Agregar foto'}
            </button>
          </>
        )}
        <p className="field-help">
          Tu publicación se guarda en el teléfono y se comparte con la comunidad cuando haya conexión.
        </p>
      </div>
    </Sheet>
  );
}
