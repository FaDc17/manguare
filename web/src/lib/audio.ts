// Prepara las guías y las reproduce con la síntesis de voz del dispositivo.

import { translate, type Language } from '../i18n/catalog';

let warned = false;

export const MIXED_AUDIO_NOTE = 'Audio de prueba. La voz en castellano lee una mezcla con términos del idioma elegido.';

// Presenta una frase mixta y conserva completo el guion de la guía.
export function guideText(text: string, language: Language, mixed: boolean): string {
  if (!mixed || language === 'es') return text;
  const help = translate(language, 'common.help');
  const community = translate(language, 'common.community');
  return `Audio de prueba. ${help} para tu ${community}. ${text}`;
}

/**
 * Voz de demostración en castellano para el texto original o la guía mixta.
 */
export function speakSpanish(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-PE';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((voice) => /^es[-_](PE|419|MX|US)$/i.test(voice.lang)) ??
      voices.find((voice) => /^es/i.test(voice.lang));
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function warnAudioUnavailableOnce(): void {
  if (warned) return;
  warned = true;
}
