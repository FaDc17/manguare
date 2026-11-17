# Manguaré

### Alertas que viajan aunque no haya señal

Prototipo funcional para comunidades amazónicas sin señal permanente: una persona
registra una emergencia en el teléfono, la alerta queda **Pendiente** en una cola
local, se envía sola al recuperar conexión (**Enviada**) y la red de salud la
confirma desde un panel web (**Recibida**).

> Estado: MVP de demostración. No reemplaza a los canales de emergencia ni a la
> radio de salud. El panel no tiene autenticación y no debe exponerse a internet.

## ¿Por qué Manguaré?

El **manguaré** es el tambor de ranura amazónico que comunidades como los Awajún
usan para enviar mensajes a distancia: un golpe que se escucha mucho más lejos
de lo que llega una voz. La app retoma esa idea: cuando no hay señal, la alerta
se guarda y se transmite en cuanto el camino se abre.

El nombre es una referencia cultural, no una apropiación: antes de usar la marca
en un piloto real, debe validarse con las comunidades y, si corresponde, contar
con su autorización.

## Demo en 60 segundos

```bash
npm install
npm run build
npm start          # deja esta terminal abierta
```

En otra terminal, opcionalmente, para cargar 3 alertas de ejemplo:

```bash
npm run seed
```

- App móvil: <http://localhost:8787>
- Panel de la red de salud: <http://localhost:8787/panel>

En la app: **Emergencia** → elegir tipo → completar detalles → **Continuar** →
**Guardar alerta**. Sin conexión verás **Pendiente**; al volver la señal cambia a
**Enviada**. En el panel, pulsa **Marcar recibida** y luego **Actualizar estado**
en el teléfono para ver **Recibida**.

Guion completo de 3 minutos: [`docs/DEMO.md`](docs/DEMO.md).

## Requisitos

- Node.js 22 o superior (probado con Node 26).
- Un navegador moderno. Para la PWA completa se necesita `localhost` o HTTPS.
- Para la demo en teléfono: ambos dispositivos en la misma Wi-Fi.

## Instalación y ejecución

```bash
npm install
npm run build          # compila la app y el panel en web/dist
npm start              # servidor en http://localhost:8787
```

Desarrollo con recarga en caliente (Vite en 5173, API en 8787):

```bash
npm run dev
```

El servidor imprime las direcciones de la red local al arrancar. Se puede cambiar
el puerto con `PORT=9000 npm start`.

### Variables de entorno

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `PORT` | `8787` | Puerto HTTP |
| `HOST` | `0.0.0.0` | Interfaz de escucha |
| `MANGUARE_DATA_FILE` | `server/data/alerts.json` | Archivo de alertas |
| `MANGUARE_STATIC_DIR` | `web/dist` | Web compilada |
| `MANGUARE_LOG` | activo | `MANGUARE_LOG=0` silencia el log por petición |
| `VITE_SMS_NUMBER` | `+51999999999` | Número de respaldo SMS (se fija al compilar) |

## Probar el modo sin conexión

1. Abre la app en `http://localhost:8787` (la PWA solo se registra en producción).
2. En **Ajustes** puedes activar **Simular sin conexión**. Es un interruptor de
   demostración: la alerta se guarda igual y se envía al desactivarlo.
3. Para una prueba real, usa el modo avión del navegador (DevTools → Network →
   Offline) o el modo avión del teléfono. La cola vive en IndexedDB y sobrevive
   a cerrar la app.
4. Al recuperar la señal, la app reintenta sola cada 20 s y también al volver a
   primer plano. El envío es idempotente por `id`: repetir no duplica alertas.

### Instalar en el teléfono

La app es una PWA instalable. En Android/Chrome abre el menú → **Instalar app**.
El service worker exige contexto seguro: funciona en `localhost` o por HTTPS.
Si abres la IP de la LAN por HTTP, la app funciona mientras la pestaña siga
abierta, pero no se instala ni recarga sin red. Para la demo final usa HTTPS
(por ejemplo un túnel) o el propio laptop con `localhost`.

## Panel de la red de salud

`/panel` muestra alertas, filtros (Todas / Por confirmar / Recibidas), datos de
contacto, ubicación aproximada si hubo consentimiento, y el botón **Marcar
recibida**. Se actualiza cada 5 segundos y suena al llegar una alerta nueva.

Limitaciones del prototipo:

- Sin autenticación ni roles. No publicar el panel en internet.
- No hay notificaciones push ni asignación de responsables.
- El SMS de respaldo abre la app de mensajes con el texto preparado; **no
  confirma la entrega** y usa un número de prueba editable en Ajustes.

## API

Servidor HTTP sin dependencias externas. Las alertas se guardan en un archivo
JSON con escritura atómica.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/health` | Estado y número de alertas |
| `GET` | `/api/alerts` | Lista de alertas |
| `POST` | `/api/alerts` | Crea una alerta (idempotente por `id`) |
| `GET` | `/api/alerts/:id` | Consulta una alerta y su estado |
| `POST` | `/api/alerts/:id/received` | Marca como recibida (idempotente) |

Ejemplo de creación:

```bash
curl -X POST http://localhost:8787/api/alerts \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "prueba-001",
    "type": "enfermedad",
    "note": "Fiebre alta desde ayer",
    "community": "Nueva Esperanza",
    "deviceName": "Celular de la comunidad",
    "consentLocation": false,
    "clientCreatedAt": "2026-11-17T12:00:00.000Z"
  }'
```

Estados: `pending` → `sent` → `received`. El cliente nunca retrocede un estado.
La ubicación solo se guarda si `consentLocation` es `true`.

## Estructura

```
web/                 App React + Vite + TypeScript (PWA)
  src/screens/       Inicio, nueva alerta, detalle, historial, ajustes
  src/lib/           Cola IndexedDB, sincronización, GPS/foto/SMS, tipos
  src/panel/         Panel web de la red de salud
  src/sw.ts          Service worker (precaché + Background Sync)
server/              API Node sin dependencias
  src/               Rutas, validación, persistencia JSON
  scripts/seed.js    Alertas de demostración
  test/              Pruebas de API
docs/DEMO.md         Guion de demostración
```

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | API + Vite con recarga |
| `npm run build` | Compila app, panel y service worker |
| `npm start` | Sirve la web compilada y la API |
| `npm run seed` | Carga 3 alertas de ejemplo idempotentes |
| `npm test` | Pruebas de la API |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run check` | Typecheck + tests + build |

Para reiniciar la demo: detén el servidor, borra `server/data/alerts.json`,
arráncalo de nuevo y ejecuta `npm run seed`.

## Privacidad y límites

- Se recoge la ubicación solo con consentimiento explícito y se muestra de forma
  aproximada. No se publica la ubicación exacta de comunidades.
- La foto es opcional, se comprime en el teléfono y se envía solo con la alerta.
- El panel debe tratarse como información sensible: acceso restringido y
  conexión segura antes de cualquier uso real.
- Awajún y Shawi aparecen como **Pendiente**: no se inventan traducciones ni
  voces sintéticas. Los textos y audios deben ser validados/grabados por
  hablantes de las comunidades.
- No se ha probado en Android de gama baja ni con la app cerrada durante horas;
  el sistema puede limitar la sincronización en segundo plano.
- El SMS es un respaldo de demostración, no un canal confirmado.

## Contexto del proyecto

El alcance y las decisiones originales están en [`HANDOFF.md`](HANDOFF.md). La
propuesta académica está en `DevUT_proyecto_APA7.pdf` y la guía de entrevista en
`Guia_entrevista_sociologo_DevUT.pdf`.
