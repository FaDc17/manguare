// Reproduce la guía y avisa si se está usando el audio mixto de la beta.

import { useTranslation } from '../i18n/LanguageContext';
import { Volume2 } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { guideText, MIXED_AUDIO_NOTE, speakSpanish } from '../lib/audio';

export function AudioButton({
  text,
  label,
  className = '',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const { t, language, visualSimulation } = useTranslation();
  const { showToast } = useApp();

  const handleClick = () => {
    const ok = speakSpanish(guideText(text, language, visualSimulation));
    if (!ok) {
      showToast(t('audioButton.esteDispositivoNoTieneAudioDisponible'), 'warn');
    } else if (visualSimulation) {
      showToast(MIXED_AUDIO_NOTE, 'warn');
    } else if (language !== 'es') {
      showToast(t('audioButton.porAhoraElAudioDeDemostracion'), 'warn');
    }
  };

  return (
    <button type="button" className={`audio-btn ${className}`} onClick={handleClick}>
      <Volume2 size={18} aria-hidden="true" />
      <span>{label ?? t('audioButton.listen')}</span>
    </button>
  );
}
