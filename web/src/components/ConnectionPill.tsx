import { Wifi, WifiOff } from 'lucide-react';

export function ConnectionPill({ online }: { online: boolean }) {
  return (
    <span
      className={`conn-pill ${online ? 'is-online' : 'is-offline'}`}
      title={online ? 'La app puede enviar alertas' : 'Las alertas se guardan hasta que vuelva la señal'}
    >
      {online ? <Wifi size={15} aria-hidden="true" /> : <WifiOff size={15} aria-hidden="true" />}
      <span>{online ? 'En línea' : 'Sin señal'}</span>
    </span>
  );
}
