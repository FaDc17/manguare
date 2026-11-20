import { Camera, ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { InterfaceError, message } from '../i18n/catalog';
import { communityLabel } from '../i18n/labels';
import { useTranslation } from '../i18n/LanguageContext';
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
  const { t } = useTranslation();
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
      showToast(error instanceof InterfaceError ? message(error.key) : message('network.noSePudoUsarLaFoto'), 'warn');
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
      showToast(message('listing.escribeUnTituloParaTuPublicacion'), 'warn');
      return;
    }
    onPublish(listing);
    reset();
  };

  return (
    <Sheet
      open={open}
      title={t('listing.publicarMiProductoOServicio')}
      onClose={close}
      footer={
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy || !title.trim()}
          data-testid="listing-publish"
          onClick={submit}
        >
          {t('community.publicar')}
        </button>
      }
    >
      <div className="net-listing-form">
        <div className="field">
          <label className="field-label" htmlFor="listing-title">
            {t('listing.titulo')}
          </label>
          <input
            id="listing-title"
            type="text"
            maxLength={80}
            value={title}
            placeholder={t('listing.ejMielPuraDeAbeja')}
            data-testid="listing-title"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="listing-category">
            {t('listing.categoria')}
          </label>
          <select
            id="listing-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {COMMUNITY_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {t(communityLabel(item.id, 'community.category.otros'))}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="listing-price">
            {t('listing.precio')}
          </label>
          <input
            id="listing-price"
            type="text"
            maxLength={30}
            value={price}
            placeholder={t('listing.ejS2030')}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="listing-location">
            {t('listing.dondeTeEncuentran')}
          </label>
          <input
            id="listing-location"
            type="text"
            maxLength={80}
            value={location}
            placeholder={t('listing.ejChiriacoImaza')}
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="listing-description">
            {t('listing.descripcion')}
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
            <img src={photo} alt={t('listing.vistaPreviaDeLaFotoDelProducto')} />
            <button
              type="button"
              className="icon-btn"
              aria-label={t('network.quitarFoto')}
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
              {busy ? t('network.procesando') : t('network.agregarFoto')}
            </button>
          </>
        )}
        <p className="field-help">
          {t('listing.tuPublicacionSeGuardaEnElTelefono')}
        </p>
      </div>
    </Sheet>
  );
}
