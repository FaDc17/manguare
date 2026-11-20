import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n/LanguageContext';

interface Shot {
  src: string;
  /** Clip H3 opcional: si no carga, se queda la imagen. */
  video?: string;
  ms: number;
}

const SHOTS: Shot[] = [
  { src: '/art/selva_amanecer.webp', ms: 1700 },
  { src: '/art/rio_maranon.webp', ms: 1700 },
  { src: '/art/manguare_tambor.webp', video: '/art/manguare_tambor.mp4', ms: 3000 },
  { src: '/art/cacao_miel.webp', ms: 1700 },
];
const TOTAL_MS = SHOTS.reduce((sum, shot) => sum + shot.ms, 0);
const SEEN_KEY = 'manguare.splash.v1';

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Intro de marca: fondos de la selva que se funden, logo devUT y «Toca para entrar». Una vez por sesión. */
export function Splash() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => !alreadySeen());
  const [leaving, setLeaving] = useState(false);
  const [shot, setShot] = useState(0);
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const finish = () => {
    if (leaving) return;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* da igual: se mostrará otra vez */
    }
    setLeaving(true);
    window.setTimeout(() => setOpen(false), 450);
  };

  useEffect(() => {
    if (!open) return;
    const timers: number[] = [];
    let elapsed = 0;
    SHOTS.forEach((item, index) => {
      if (index > 0) timers.push(window.setTimeout(() => setShot(index), elapsed));
      elapsed += item.ms;
    });
    timers.push(window.setTimeout(finish, reduced ? 2200 : TOTAL_MS + 400));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`splash ${leaving ? 'is-leaving' : ''} ${reduced ? 'is-reduced' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={t('splash.manguareTocaParaEntrar')}
      data-testid="splash"
      onClick={finish}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') finish();
      }}
    >
      {SHOTS.map((item, index) => (
        <ShotLayer key={item.src} shot={item} on={index === shot} reduced={reduced} />
      ))}
      <div className="splash-shade" />
      <div className="splash-content">
        <img className="splash-logo" src="/brand/devut-logo.png" alt="devUT" />
        <p className="splash-name">Manguaré</p>
        <p className="splash-tag">{t('splash.tuVozLlegaIncluso')}</p>
      </div>
      <p className="splash-skip">{t('splash.tocaParaEntrar')}</p>
    </div>
  );
}

function ShotLayer({ shot, on, reduced }: { shot: Shot; on: boolean; reduced: boolean }) {
  const [videoOk, setVideoOk] = useState(true);
  const ref = useRef<HTMLVideoElement>(null);
  const useVideo = Boolean(shot.video) && videoOk && !reduced;

  useEffect(() => {
    const video = ref.current;
    if (!video || !on) return;
    video.currentTime = 0;
    void video.play().catch(() => setVideoOk(false));
  }, [on]);

  if (useVideo) {
    return (
      <video
        ref={ref}
        className={`splash-shot splash-video ${on ? 'is-on' : ''}`}
        src={shot.video}
        poster={shot.src}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onError={() => setVideoOk(false)}
      />
    );
  }
  return (
    <img
      src={shot.src}
      alt=""
      className={`splash-shot ${on ? 'is-on' : ''}`}
      decoding="async"
    />
  );
}
