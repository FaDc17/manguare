import { Phone, Radio } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { Sheet } from './Sheet';

const NUMBERS = [
  { number: '106', label: 'SAMU', detail: 'Emergencias de salud' },
  { number: '116', label: 'Bomberos', detail: 'Incendios y rescate' },
  { number: '105', label: 'Policía', detail: 'Seguridad y auxilio' },
];

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings } = useApp();
  const healthPost = settings.healthPost.trim();
  const healthPhone = settings.healthPhone.trim();

  return (
    <Sheet open={open} title="Números de ayuda" onClose={onClose}>
      <p className="sheet-intro">
        {healthPost ? `Tu puesto de salud: ${healthPost}. ` : ''}
        Estos números necesitan señal telefónica. Si no tienes señal, usa la alerta de Manguaré y el
        SMS de respaldo: quedarán guardados y se enviarán cuando haya conexión.
      </p>
      <div className="help-list">
        {healthPhone ? (
          <a className="help-item" href={`tel:${healthPhone.replace(/[^\d+*#]/g, '')}`}>
            <span className="help-icon">
              <Phone size={19} aria-hidden="true" />
            </span>
            <span className="help-copy">
              <span className="help-label">Puesto de salud</span>
              <span className="help-detail">{healthPost || 'Contacto de la comunidad'}</span>
            </span>
            <span className="help-number">{healthPhone}</span>
          </a>
        ) : null}
        {NUMBERS.map((item) => (
          <a key={item.number} className="help-item" href={`tel:${item.number}`}>
            <span className="help-icon">
              <Phone size={19} aria-hidden="true" />
            </span>
            <span className="help-copy">
              <span className="help-label">{item.label}</span>
              <span className="help-detail">{item.detail}</span>
            </span>
            <span className="help-number">{item.number}</span>
          </a>
        ))}
      </div>
      <div className="notice-box">
        <strong>Manguaré complementa, no reemplaza</strong>
        <p>
          Manguaré no es un servicio de rescate. Si hay señal, llama también a los servicios de
          emergencia o a la radio del puesto de salud.
        </p>
      </div>
      <p className="sheet-footnote">
        <Radio size={15} aria-hidden="true" /> En zonas sin señal, la radio del puesto de salud sigue
        siendo el canal principal.
      </p>
    </Sheet>
  );
}
