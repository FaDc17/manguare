import { Volume2 } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { speakSpanish } from '../lib/audio';

export function AudioButton({
  text,
  label = 'Escuchar',
  className = '',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const { showToast, settings } = useApp();

  const handleClick = () => {
    const ok = speakSpanish(text);
    if (!ok) {
      showToast('Este dispositivo no tiene audio disponible.', 'warn');
    } else if (settings.language !== 'es') {
      showToast('Por ahora el audio de demostración está en castellano.', 'warn');
    }
  };

  return (
    <button type="button" className={`audio-btn ${className}`} onClick={handleClick}>
      <Volume2 size={18} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
