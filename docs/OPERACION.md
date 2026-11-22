# Operación y despliegue — Manguaré

Esta guía cubre cómo ejecutar el prototipo de forma segura, qué variables de
entorno existen y qué falta antes de un piloto real. No sustituye el protocolo de
la red de salud: la app avisa, las personas responden.

## 1. Modos de ejecución

### Demostración local (sin contraseña)

```bash
npm install
npm run build
npm start
```

- App: <http://localhost:8787>
- Panel: <http://localhost:8787/panel>

En este modo el panel queda **abierto**. Es deliberado para ensayar la demo y el
servidor lo advierte al arrancar. No lo publiques en una red compartida.

### Demo o piloto con panel protegido

```bash
MANGUARE_PANEL_PASSWORD='una-clave-larga' \
MANGUARE_SESSION_SECRET="$(openssl rand -base64 48)" \
npm start
```

El panel pide usuario (`salud` por defecto) y contraseña. La sesión dura 12 horas
y vive en memoria: se invalida al reiniciar el servidor. Fijar
`MANGUARE_SESSION_SECRET` no conserva las sesiones activas.

### Docker

```bash
cp .env.example .env
# edita .env: cambia la contraseña y el secreto
docker compose up -d --build
docker compose logs -f
```

Los datos quedan en el volumen `manguare-data` (`/data/alerts.json`,
`/data/biodiversity.json` y `/data/social.json`). Si ya existe un contenedor de
una versión anterior con publicaciones sociales, copia primero su archivo
`/app/server/data/social.json` al volumen antes de recrearlo: ese archivo antiguo
no estaba en el volumen y Docker no puede recuperarlo tras eliminar el contenedor.

Para una imagen sin Compose:

```bash
docker build -t manguare .
docker run -d --name manguare -p 8787:8787 \
  -e MANGUARE_PANEL_PASSWORD='una-clave-larga' \
  -e MANGUARE_SESSION_SECRET='un-secreto-largo' \
  -v manguare-data:/data \
  manguare
```

## 2. Variables de entorno

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `PORT` | `8787` | Puerto HTTP |
| `HOST` | `0.0.0.0` | Interfaz de escucha |
| `MANGUARE_DATA_FILE` | `server/data/alerts.json` | Archivo JSON de alertas |
| `MANGUARE_BIODIVERSITY_FILE` | `server/data/biodiversity.json` | Archivo JSON de reportes de biodiversidad |
| `MANGUARE_SOCIAL_FILE` | `server/data/social.json` | Archivo JSON de publicaciones sociales; Docker usa `/data/social.json` |
| `MANGUARE_STATIC_DIR` | `web/dist` | Web compilada |
| `MANGUARE_LOG` | activo | `MANGUARE_LOG=0` silencia el log por petición |
| `MANGUARE_PANEL_PASSWORD` | vacío | Si se define, el panel exige login |
| `MANGUARE_PANEL_USER` | `salud` | Usuario del panel |
| `MANGUARE_SESSION_SECRET` | aleatorio por arranque | Firma/deriva las sesiones; fíjalo en producción |
| `MANGUARE_SESSION_HOURS` | `12` | Duración de la sesión |
| `MANGUARE_ACK_MINUTES` | `10` | Plazo para que la red confirme una alerta |
| `MANGUARE_ESCALATION_PHONE` | vacío | Número que recibe el SMS de escalamiento |
| `MANGUARE_SECURE_COOKIES` | `0` | `1` para cookie `Secure` detrás de HTTPS |
| `MANGUARE_TRUST_PROXY` | `0` | `1` para leer `X-Forwarded-For` del proxy |
| `VITE_SMS_NUMBER` | `+51999999999` | Número de respaldo SMS (se fija al compilar) |

> `MANGUARE_TRUST_PROXY=1` solo si hay un proxy de confianza delante. Si se deja
> activo sin proxy, cualquiera puede falsear su IP y saltarse el límite de
> intentos.

## 3. HTTPS y exposición

Para una demo desde el teléfono:

```bash
npm run build
npm start
# en otra terminal
cloudflared tunnel --url http://localhost:8787
```

Con HTTPS, la PWA se instala y el service worker funciona. Si el panel está
publicado, define contraseña **antes** de abrir el túnel.

Para un servidor propio, coloca Nginx/Caddy delante y activa:

```bash
MANGUARE_SECURE_COOKIES=1
MANGUARE_TRUST_PROXY=1
```

El servidor ya envía cabeceras de seguridad y una CSP para el HTML. No hay CORS
abierto: la app se sirve desde el mismo origen que la API.

## 4. Respaldos y retención

Todo vive en `alerts.json` y `biodiversity.json` (incluidas las fotos en base64). Son archivos que se
reescribe completo en cada cambio; para un piloto con muchas alertas conviene
migrar a base de datos y almacenamiento de objetos.

Respaldo manual:

```bash
# servidor detenido o en una ventana de baja actividad
cp server/data/alerts.json "respaldo-alertas-$(date +%F-%H%M).json"
cp server/data/biodiversity.json "respaldo-biodiversidad-$(date +%F-%H%M).json"
```

Con Docker:

```bash
docker run --rm -v manguare-data:/data -v "$PWD":/backup alpine \
  cp /data/alerts.json "/backup/respaldo-alertas-$(date +%F-%H%M).json"
  cp /data/biodiversity.json "/backup/respaldo-biodiversidad-$(date +%F-%H%M).json"
```

Restauración: detén el servidor, reemplaza el archivo y arráncalo de nuevo. Si el
JSON está corrupto, el servidor lo mueve a `alerts.json.corrupt-<marca>` y arranca
vacío; conserva ese archivo para recuperar datos.

Recomendaciones para un piloto:

- Respaldo diario y antes de cada actualización.
- Retención definida con la red de salud (por ejemplo, 90 días para fotos).
- Borrar fotos cuando ya no sean necesarias para la respuesta.
- No compartir `alerts.json` ni `biodiversity.json` por canales informales: contienen datos personales y fotos.

## 5. Acceso y roles

Hoy existe **un solo usuario** de panel y no hay roles. Para un piloto:

- Una cuenta por turno o por responsable, no una compartida.
- Rotar la contraseña al terminar el piloto.
- No reutilizar la contraseña de otros sistemas.
- Registrar en papel o en un sistema aparte quién estaba de turno: el panel
  guarda `acknowledgedBy` con el usuario, pero no distingue personas.

Siguiente paso técnico: usuarios múltiples, roles (lectura / confirmación /
administración) y auditoría persistente fuera del archivo de alertas.

## 6. Protocolo de respuesta (definir antes del piloto)

Manguaré no reemplaza a la radio ni al SAMU. Antes de usarlo con una comunidad,
la red de salud debe acordar y escribir:

1. Quién revisa el panel y en qué horario.
2. En cuánto tiempo se confirma una alerta (hoy 10 min por defecto).
3. Qué se hace si nadie confirma: el panel la marca **Vencida** y muestra el SMS
   de escalamiento al número configurado.
4. Qué significan las respuestas rápidas (“en camino”, “acude a la posta”,
   “coordinar traslado”) y quién puede enviarlas.
5. Qué hacer si la alerta llega horas después.
6. Cómo se avisa a la comunidad que la alerta fue recibida.
7. Quién puede ver ubicación y fotos, y por cuánto tiempo.

Sin ese protocolo, una alerta confirmada en el panel puede dar falsa seguridad.
El SMS de escalamiento se abre en la app de mensajes del operador: no hay envío
automático ni confirmación de entrega.

## 7. Diagnóstico rápido

| Síntoma | Revisión |
| --- | --- |
| El panel responde 401 | Inicia sesión; la sesión pudo expirar |
| El panel no acepta la contraseña | Revisa `MANGUARE_PANEL_PASSWORD` y reinicia |
| El teléfono queda en Pendiente | ¿Hay red? ¿El servidor responde `/api/health`? |
| El teléfono no ve la confirmación | Toca **Actualizar estado**; la app consulta sola cada 20 s con pendientes y cada 2 min sin pendientes |
| Una alerta aparece Vencida | La red no confirmó antes de `MANGUARE_ACK_MINUTES`; usa el SMS de escalamiento o llama al 106 |
| No aparece el SMS de escalamiento | Define `MANGUARE_ESCALATION_PHONE` y reinicia el servidor |
| El panel está vacío | `npm run seed` con el servidor encendido |
| El servidor no arranca | Puerto ocupado (`PORT=9000 npm start`) o datos corruptos (ver arriba) |
| La PWA no se instala | Necesita `localhost` o HTTPS |
| El login devuelve 429 | Espera 15 minutos; hay límite de intentos por IP |

## 8. Límites conocidos

- Persistencia en un único archivo JSON, sin base de datos ni backups automáticos.
- Fotos en base64 dentro del JSON: archivo pesado y reescritura completa.
- Sesiones en memoria: un reinicio cierra todas las sesiones.
- Sin notificaciones push: el panel suena solo si está abierto.
- El SMS abre la app de mensajes y no confirma entrega; el escalamiento tampoco
  se envía solo.
- Sin asignación de responsables ni historial de auditoría fuera de la alerta.
- El service worker y el Background Sync dependen de Android/Chrome; falta la
  prueba en equipos físicos de gama baja (ver `docs/PRUEBAS.md`).
