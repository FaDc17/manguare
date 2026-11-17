let warned = false;

/**
 * Audio de demostración en castellano. Las lenguas awajún y shawi no usan
 * voz sintética: sus audios deben ser grabados por hablantes de la comunidad.
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
