import { useEffect, useState } from 'react';

const SHOTS = [
  '/art/selva_amanecer.webp',
  '/art/rio_maranon.webp',
  '/art/manguare_tambor.webp',
  '/art/cacao_miel.webp',
];
const SEEN_KEY = 'manguare.splash.v1';
const SHOT_MS = 1700;

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Intro de marca: fondos de la selva que se funden, logo devUT y «Toca para entrar». Una vez por sesión. */
export function Splash() {
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
    const rotate = window.setInterval(() => setShot((value) => (value + 1) % SHOTS.length), SHOT_MS);
    const auto = window.setTimeout(finish, reduced ? 2200 : SHOT_MS * SHOTS.length + 400);
    return () => {
      window.clearInterval(rotate);
      window.clearTimeout(auto);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`splash ${leaving ? 'is-leaving' : ''} ${reduced ? 'is-reduced' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Manguaré. Toca para entrar"
      data-testid="splash"
      onClick={finish}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') finish();
      }}
    >
      {SHOTS.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          className={`splash-shot ${index === shot ? 'is-on' : ''}`}
          decoding="async"
        />
      ))}
      <div className="splash-shade" />
      <div className="splash-content">
        <img className="splash-logo" src="/brand/devut-logo.png" alt="devUT" />
        <p className="splash-name">Manguaré</p>
        <p className="splash-tag">Tu voz llega, incluso sin señal</p>
      </div>
      <p className="splash-skip">Toca para entrar</p>
    </div>
  );
}
