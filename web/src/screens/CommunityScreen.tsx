import { useMemo, useState } from 'react';
import {
  ChevronRight,
  Leaf,
  MapPin,
  Plus,
  ShieldCheck,
  Star,
  Store,
  TriangleAlert,
} from 'lucide-react';
import { useApp } from '../app/AppContext';
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_LISTINGS,
  ENVIRONMENT_TOPICS,
  SUPPORT_CENTERS,
} from '../lib/community';

export function CommunityScreen() {
  const { showToast } = useApp();
  const [category, setCategory] = useState<string>('todos');

  const listings = useMemo(
    () =>
      category === 'todos'
        ? COMMUNITY_LISTINGS
        : COMMUNITY_LISTINGS.filter((item) => item.category === category),
    [category],
  );

  return (
    <div className="screen community">
      <header className="screen-head">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-dot" /> Compra y ofrece cerca de ti
          </p>
          <h1>Conecta Amazonía</h1>
          <p className="screen-lead">
            Servicios, productos y centros de apoyo de la comunidad, también sin conexión.
          </p>
        </div>
      </header>

      <section className="card community-publish">
        <div className="community-publish-copy">
          <span className="community-publish-icon">
            <Store size={22} aria-hidden="true" />
          </span>
          <div>
            <strong>Publica mi servicio</strong>
            <p>Haz visible tu emprendimiento cuando vuelva la señal.</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            showToast('La publicación estará disponible en el piloto con la comunidad.', 'warn')
          }
        >
          <Plus size={17} aria-hidden="true" /> Publicar
        </button>
      </section>

      <div className="community-chips" role="tablist" aria-label="Categorías de la comunidad">
        <button
          type="button"
          role="tab"
          aria-selected={category === 'todos'}
          className={`community-chip ${category === 'todos' ? 'is-active' : ''}`}
          onClick={() => setCategory('todos')}
        >
          Todos
        </button>
        {COMMUNITY_CATEGORIES.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={category === item.id}
              className={`community-chip ${category === item.id ? 'is-active' : ''}`}
              onClick={() => setCategory(item.id)}
            >
              <Icon size={14} aria-hidden="true" /> {item.label}
            </button>
          );
        })}
      </div>

      <section className="community-section" aria-labelledby="community-listings">
        <div className="section-head">
          <h2 id="community-listings">Recomendado cerca de ti</h2>
          <span className="demo-badge">Datos de demo</span>
        </div>
        {listings.length > 0 ? (
          <div className="community-list">
            {listings.map((item) => (
              <article key={item.id} className="community-card">
                <div className="community-card-top">
                  <span className="community-card-tag">
                    {COMMUNITY_CATEGORIES.find((cat) => cat.id === item.category)?.label ??
                      'Comunidad'}
                  </span>
                  <span className="community-rating">
                    <Star size={13} aria-hidden="true" /> {item.rating}
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div className="community-card-foot">
                  <span>
                    <MapPin size={14} aria-hidden="true" /> {item.location}
                  </span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() =>
                      showToast('Los contactos se habilitarán en el piloto.', 'warn')
                    }
                  >
                    Ver más <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="community-empty">
            <Store size={22} aria-hidden="true" />
            <p>Todavía no hay publicaciones en esta categoría.</p>
          </div>
        )}
      </section>

      <section className="community-section" aria-labelledby="community-centers">
        <div className="section-head">
          <h2 id="community-centers">Centros de apoyo próximos</h2>
          <span className="demo-badge">Distancias de demo</span>
        </div>
        <p className="community-section-lead">
          Puntos de auxilio para llamar o acudir. No reemplazan a la radio del puesto de salud.
        </p>
        <div className="center-list">
          {SUPPORT_CENTERS.map((center) => (
            <div key={center.id} className="center-row">
              <span className="center-icon">
                <MapPin size={19} aria-hidden="true" />
              </span>
              <span className="center-copy">
                <strong>{center.name}</strong>
                <span>
                  {center.distance} · {center.note}
                </span>
              </span>
              <button
                type="button"
                className="text-btn"
                onClick={() =>
                  showToast(`${center.name}: ${center.distance}. Dato de demostración.`, 'ok')
                }
              >
                Ver
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="community-section environment" aria-labelledby="community-environment">
        <div className="environment-head">
          <span className="environment-icon">
            <Leaf size={21} aria-hidden="true" />
          </span>
          <div>
            <h2 id="community-environment">Alerta Amazonía</h2>
            <p>Proteger la Amazonía es proteger la vida. Reporta lo que daña el bosque o los ríos.</p>
          </div>
        </div>
        <div className="environment-topics">
          {ENVIRONMENT_TOPICS.map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() =>
            showToast(
              'La red ambiental se habilitará en el piloto; por ahora usa Emergencia si hay peligro.',
              'warn',
            )
          }
        >
          <TriangleAlert size={17} aria-hidden="true" /> Reportar una alerta
        </button>
        <p className="environment-note">
          <ShieldCheck size={14} aria-hidden="true" /> Solo el líder o el centro encargado verá el
          reporte.
        </p>
      </section>

      <p className="disclaimer">
        Contenido de demostración tomado del prototipo de Figma. No hay pagos ni contactos reales
        habilitados.
      </p>
    </div>
  );
}
