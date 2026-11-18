# Manguaré

### Alertas que viajan aunque no haya señal

Prototipo funcional para comunidades amazónicas sin señal permanente: una persona
registra una emergencia en el teléfono, la alerta queda **Pendiente** en una cola
local, se envía sola al recuperar conexión (**Enviada**) y la red de salud la
confirma desde un panel web (**Recibida**).

> Estado: MVP de demostración. No reemplaza a los canales de emergencia ni a la
> radio de salud. El panel puede protegerse con una contraseña; sin configurarla
> queda abierto y no debe exponerse a internet.

## ¿Por qué Manguaré?

El **manguaré** es el tambor de ranura amazónico que comunidades como los Awajún
usan para enviar mensajes a distancia: un golpe que se escucha mucho más lejos
de lo que llega una voz. La app retoma esa idea: cuando no hay señal, la alerta
se guarda y se transmite en cuanto el camino se abre.

La versión actual integra además el prototipo de Figma del equipo: acceso con
número y PIN, perfil de la comunidad, el catálogo **Conecta Amazonía** y centros
de apoyo de demostración. El acceso con PIN es **solo de demostración**: no es
autenticación real ni protege datos.

El panel de la red añade un **plazo de acuse**, alertas **vencidas**, escalamiento
por SMS y **respuestas rápidas** que el teléfono recibe al sincronizar.

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

Accesos de demostración de la app (tomados del prototipo de Figma):

| Perfil | Número | PIN |
| --- | --- | --- |
| Usuario (Juan) | `992066275` | `123456` |
| Admin (red de salud) | `987654321` | `123456` |

En la app: **Emergencia** → elegir tipo → completar detalles → **Continuar** →
**Guardar alerta**. Sin conexión verás **Pendiente**; al volver la señal cambia a
**Enviada**. En el panel, pulsa **Marcar recibida** y luego **Actualizar estado**
en el teléfono para ver **Recibida**.

Guion completo de 3 minutos: [`docs/DEMO.md`](docs/DEMO.md).

## Estado actual de la app de población

**Actualizado: 18-11-2026.**

Se mantuvo la PWA existente, su cola offline y el panel administrativo separado.
En la app de población se agregaron:

- Confirmación rápida de SOS, envío mínimo y detalle adjunto a la misma alerta.
- Listado de Conecta Amazonía con filtros por ubicación, detalle de publicación y
  contactos de la localidad para la demostración.
- Reporte de biodiversidad con categorías, foto y ubicación; el panel ahora lista
  esos reportes y permite marcarlos como leídos.
- Registro local con validaciones, selector de fotos de DNI de demostración y
  aceptación de términos.
- Mapa con OpenStreetMap, búsqueda y filtros **Conecta** y **Centro de apoyo**.
  Sin conexión se muestra la lista y un aviso: el mapa necesita red para las
  teselas.

Las cuentas nuevas solo existen en el navegador/dispositivo donde se registran;
las fotos del DNI son vistas previas temporales y no se verifican ni se envían.
Las publicaciones, nombres, reseñas, ubicaciones y centros de apoyo son datos de
demostración proporcionados por el equipo; no deben tratarse como directorio
oficial sin validación.

**Verificación:** `npm run check` pasa (typecheck, pruebas de API y web, build);
`npm run test:e2e` cubre SOS, publicaciones, biodiversidad, mapa, registro y
lectura desde el panel.

**Prueba local:** ejecuta `npm start` y abre <http://localhost:8787>. Acceso demo:
celular `992066275`, PIN `123456`. No uses datos personales reales en una demo
pública.

## Para el equipo: probar esta versión

Esta es la versión de prueba del **18-11-2026**. Incluye acceso demo, cola offline,
panel con contraseña, plazo de acuse, alertas vencidas, escalamiento por SMS y
respuestas de la red.

### 1. Levantar la app

```bash
git clone https://github.com/ProgramaGrueso/manguare.git
cd manguare
npm install
npm run build
npm start
```

Abre <http://localhost:8787> y <http://localhost:8787/panel>. Para mostrar el
vencimiento rápido:

```bash
MANGUARE_ACK_MINUTES=1 \
MANGUARE_ESCALATION_PHONE=+51999999999 \
npm start
```

### 2. Checklist de pruebas

| # | Prueba | Resultado esperado |
| --- | --- | --- |
| 1 | Entrar con usuario `992066275` / PIN `123456` | Inicio con “Hola, Juan” |
| 2 | Entrar con admin `987654321` / PIN `123456` | Aparece **Panel de la red** |
| 3 | Crear alerta con **Simular sin conexión** | Queda **Pendiente** |
| 4 | Desactivar la simulación | Pasa a **Enviada** sin duplicarse |
| 5 | En el panel, **Marcar recibida** | El teléfono pasa a **Recibida** |
| 6 | Enviar respuesta **“Ambulancia o brigada en camino”** | El teléfono muestra la respuesta |
| 7 | Crear alerta y no confirmarla con `MANGUARE_ACK_MINUTES=1` | Panel la marca **Vencida** y ofrece SMS/llamada |
| 8 | Abrir **Comunidad → Conecta Amazonía** | Aparecen Miel, Transporte y centros de apoyo |
| 9 | **Ajustes → Cerrar sesión** | Vuelve a la pantalla de acceso |
| 10 | Recargar la app con una sesión abierta | La sesión y la cola se conservan |

Pruebas automáticas:

```bash
npm run check      # typecheck + 35 pruebas + build
npm run test:e2e   # recorrido completo con Chromium (requiere build)
```

### 3. Probar en teléfono

- Usa `localhost` o HTTPS. Por IP de LAN en HTTP la PWA no se instala ni funciona
  sin pestaña abierta.
- Prueba **modo avión**, cerrar la pestaña, volver a abrir y recuperar señal.
- El protocolo completo para Android de gama baja está en
  [`docs/PRUEBAS.md`](docs/PRUEBAS.md).

### 4. Cómo reportar un hallazgo

Incluye:

- modelo de teléfono, versión de Android y de Chrome;
- pasos exactos para reproducirlo;
- qué esperabas y qué pasó;
- captura o video si es visual;
- si estabas sin conexión, con conexión intermitente o con el servidor caído.

Abre un issue en <https://github.com/ProgramaGrueso/manguare/issues> con la
etiqueta `prueba`. No publiques ubicaciones reales ni datos de personas.

### 5. Límites de esta versión

- El PIN de la app es de demostración: no es autenticación real.
- El SMS de escalamiento abre la app de mensajes; no hay envío automático ni
  confirmación de entrega.
- El panel tiene un solo usuario y no tiene roles.
- Awajún y Shawi siguen pendientes de grabación con hablantes.
- Falta la prueba en un Android físico de gama baja.
- Más detalle: [`docs/OPERACION.md`](docs/OPERACION.md) y
  [`docs/PRUEBAS.md`](docs/PRUEBAS.md).

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

### Panel protegido con contraseña

Para una demo compartida o un piloto, arranca con una contraseña:

```bash
MANGUARE_PANEL_PASSWORD='una-clave-larga' \
MANGUARE_SESSION_SECRET="$(openssl rand -base64 48)" \
npm start
```

El panel pide usuario (`salud` por defecto) y contraseña. Sin esa variable el
panel queda en modo demostración, abierto, y el servidor lo advierte al arrancar.

### Docker

```bash
cp .env.example .env    # cambia la contraseña y el secreto
docker compose up -d --build
```

Los datos quedan en el volumen `manguare-data`. La guía completa está en
[`docs/OPERACION.md`](docs/OPERACION.md).

### Variables de entorno

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `PORT` | `8787` | Puerto HTTP |
| `HOST` | `0.0.0.0` | Interfaz de escucha |
| `MANGUARE_DATA_FILE` | `server/data/alerts.json` | Archivo de alertas |
| `MANGUARE_STATIC_DIR` | `web/dist` | Web compilada |
| `MANGUARE_LOG` | activo | `MANGUARE_LOG=0` silencia el log por petición |
| `MANGUARE_PANEL_PASSWORD` | vacío | Si se define, el panel exige login |
| `MANGUARE_PANEL_USER` | `salud` | Usuario del panel |
| `MANGUARE_SESSION_SECRET` | aleatorio | Fija un secreto para conservar sesiones al reiniciar |
| `MANGUARE_SESSION_HOURS` | `12` | Duración de la sesión del panel |
| `MANGUARE_ACK_MINUTES` | `10` | Plazo para que la red confirme una alerta |
| `MANGUARE_ESCALATION_PHONE` | vacío | Número para el SMS de escalamiento del panel |
| `MANGUARE_BIODIVERSITY_FILE` | `server/data/biodiversity.json` | Archivo separado para reportes de biodiversidad |
| `MANGUARE_SECURE_COOKIES` | `0` | `1` para cookie `Secure` detrás de HTTPS |
| `MANGUARE_TRUST_PROXY` | `0` | `1` para leer `X-Forwarded-For` de un proxy de confianza |
| `VITE_SMS_NUMBER` | `+51999999999` | Número de respaldo SMS (se fija al compilar) |

### Reportes de biodiversidad y panel externo

La app de población guarda los reportes sin conexión y los envía a una API separada
de las emergencias. Se conservan en `MANGUARE_BIODIVERSITY_FILE` (en Docker, dentro
del volumen persistente). El panel externo no se modifica ni se integra
automáticamente: para mostrarlos, su equipo debe consultar estos endpoints:

| Método | Ruta | Uso |
| --- | --- | --- |
| `POST` | `/api/biodiversity` | Recibir un reporte de la app de población |
| `GET` | `/api/biodiversity` | Listar reportes para la sesión del panel |
| `GET` | `/api/biodiversity/:id` | Leer el detalle de un reporte para la sesión del panel |
| `POST` | `/api/biodiversity/:id/read` | Marcarlo como leído desde la sesión del panel |
| `GET` | `/api/biodiversity/:id/status` | Consultar solo estado y fechas para sincronizar el teléfono |

El panel debe usar la sesión autenticada del servidor en las rutas de lista,
detalle y marcado como leído. `POST` recibe los campos `id`, `category`, `title`,
`description`, `community`, `reportedBy`, `clientCreatedAt` y, opcionalmente,
`location` y `photo`. La ruta pública de estado solo devuelve `id`, `state`,
`serverReceivedAt` y `readAt`; no devuelve el contenido del reporte. Si se configura
`MANGUARE_PANEL_PASSWORD`, el acceso del panel requiere iniciar sesión. No expongas
el servidor en internet sin configurar esa protección. Si el panel está alojado
en otro dominio, su backend debe consumir la API o servirla mediante un proxy del
mismo origen; la API no habilita CORS. No pongas la contraseña del panel en el
código del navegador.

La respuesta del listado tiene la forma `{ "reports": [...] }`; cada elemento
incluye `state` (`sent` o `read`) y `serverReceivedAt`, y, cuando corresponda,
`readAt` y `readBy`. Marcarlo como leído devuelve `{ "report": {...} }`. El equipo
del panel externo debe implementar su propia pantalla y acción para usar este
contrato; esta app no incluye ni modifica ese panel.

El registro de población y sus PIN de demostración se guardan solo en ese navegador
y dispositivo; no crean cuentas compartidas entre dispositivos. Las fotos del DNI
del flujo de líder solo se previsualizan durante el registro y no se validan ni se
envían. El mapa usa teselas públicas de OpenStreetMap y ubicaciones de demostración;
no muestra alertas ni ubicaciones de emergencia.

## Probar el modo sin conexión

1. Abre la app en `http://localhost:8787` (la PWA solo se registra en producción).
2. En **Ajustes** puedes activar **Simular sin conexión**. Es un interruptor de
   demostración: la alerta se guarda igual y se envía al desactivarlo.
3. Para una prueba real, usa el modo avión del navegador (DevTools → Network →
   Offline) o el modo avión del teléfono. La cola vive en IndexedDB y sobrevive
   a cerrar la app.
4. Al recuperar la señal, la app reintenta sola con espera progresiva (15 s, 45 s,
   2 min y luego cada 5 min) y también al volver a primer plano o al recuperar
   conexión. El envío es idempotente por `id`: repetir no duplica alertas.

### Instalar en el teléfono

La app es una PWA instalable. En Android/Chrome abre el menú → **Instalar app**.
El service worker exige contexto seguro: funciona en `localhost` o por HTTPS.
Si abres la IP de la LAN por HTTP, la app funciona mientras la pestaña siga
abierta, pero no se instala ni recarga sin red. Para la demo final usa HTTPS
(por ejemplo un túnel) o el propio laptop con `localhost`.

## Panel de la red de salud

### ¿Para quién es?

El panel es para el **lado receptor de la alerta**: la red de salud, el puesto de
salud, el municipio o un promotor autorizado. No es para la persona que reporta
la emergencia; esa usa la app móvil.

En un piloto debe haber una persona responsable por turno que:

- revise las alertas y confirme la recepción;
- responda a la comunidad (“ambulancia en camino”, “acude a la posta”, etc.);
- vigile las alertas **vencidas** y escale por SMS o llamada;
- trate la ubicación y las fotos como datos sensibles.

Hoy el panel tiene **un solo usuario** (`salud` por defecto) y no distingue roles
ni turnos. Para un piloto hay que crear cuentas por responsable.

### Enlaces y contraseñas de demo

Los enlaces de túnel y las contraseñas de una demo **no se guardan en este
README**: son temporales y el repositorio es público. Se comparten por el canal
del equipo. Para levantar una demo protegida:

```bash
MANGUARE_PANEL_PASSWORD='una-clave-temporal' \
MANGUARE_SESSION_SECRET="$(openssl rand -base64 48)" \
npm start

# en otra terminal
cloudflared tunnel --url http://localhost:8787
```

El panel pide usuario (`salud` por defecto) y la contraseña que definas.

`/panel` muestra alertas, filtros (Todas / En plazo / Vencidas / Recibidas),
datos de contacto, ubicación aproximada si hubo consentimiento, y el botón
**Marcar recibida**. Se actualiza cada 5 segundos y suena al llegar una alerta
nueva o al vencer un plazo.

Cada alerta tiene un **plazo de acuse** (`MANGUARE_ACK_MINUTES`, 10 por defecto).
Si la red no confirma a tiempo, la alerta pasa a **Vencida**, se registra el
escalamiento y el panel ofrece un **SMS de escalamiento** al número configurado
en `MANGUARE_ESCALATION_PHONE` (o llamar al 106). La red también puede enviar
**respuestas rápidas** a la comunidad: “ambulancia en camino”, “acude a la posta”,
“coordinar traslado” u otra indicación. El teléfono las recibe en la siguiente
sincronización.

El panel también muestra los **reportes de biodiversidad** enviados desde la app y
permite marcarlos como leídos. Se guardan aparte de las emergencias, en
`MANGUARE_BIODIVERSITY_FILE`.

Con `MANGUARE_PANEL_PASSWORD` definida, el panel pide login y usa una cookie de
sesión `HttpOnly`; la confirmación queda auditada con el usuario. Sin esa
variable, el panel queda abierto para la demo.

Limitaciones del prototipo:

- Un solo usuario, sin roles ni cuentas por turno. No publicar el panel sin
  contraseña.
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
| `POST` | `/api/alerts/:id/received` | Marca como recibida (idempotente; requiere sesión si el panel está protegido) |
| `POST` | `/api/alerts/:id/escalate` | Registra un escalamiento manual (`sms`, `llamada` o `manual`) |
| `POST` | `/api/alerts/:id/responses` | Guarda una respuesta de la red y confirma la recepción |
| `GET` | `/api/panel/session` | Estado de la sesión, plazo de acuse y teléfono de escalamiento |
| `POST` | `/api/panel/login` | Inicia sesión con usuario y contraseña |
| `POST` | `/api/panel/logout` | Cierra la sesión |

La creación de alertas es pública para que el teléfono pueda enviar sin una cuenta
(con límite de 120 por 10 minutos por IP). La lista completa y la confirmación
requieren sesión cuando `MANGUARE_PANEL_PASSWORD` está definida. El teléfono
consulta solo sus propias alertas por `id`, sin descargar la lista de la red.

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
  src/screens/       Acceso, inicio, nueva alerta, detalle, historial, comunidad, ajustes
  src/lib/           Cola IndexedDB, reintentos, sincronización, sesión demo, GPS/foto/SMS
  src/panel/         Panel web de la red de salud (login incluido)
  src/sw.ts          Service worker (precaché + Background Sync)
  test/              Pruebas de cola offline, acceso demo y plazos
server/              API Node sin dependencias
  src/               Rutas, validación, autenticación, persistencia JSON
  scripts/seed.js    Alertas de demostración
  test/              Pruebas de API, sesión y plazos de acuse
scripts/e2e.mjs      Recorrido completo con Chromium
docs/DEMO.md         Guion de demostración
docs/OPERACION.md    Despliegue, seguridad, respaldos y protocolo
docs/PRUEBAS.md      Verificación de fases 1-3 y prueba en Android
Dockerfile           Imagen de producción
docker-compose.yml   Despliegue con volumen persistente
```

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | API + Vite con recarga |
| `npm run build` | Compila app, panel y service worker |
| `npm start` | Sirve la web compilada y la API |
| `npm run seed` | Carga 3 alertas de ejemplo idempotentes |
| `npm test` | Pruebas de API, cola offline, acceso demo y plazos |
| `npm run test:e2e` | Recorrido completo con Chromium (requiere build) |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run check` | Typecheck + pruebas + build |

Para reiniciar la demo: detén el servidor, borra `server/data/alerts.json`,
arráncalo de nuevo y ejecuta `npm run seed`.

## Privacidad y límites

- Se recoge la ubicación solo con consentimiento explícito y se muestra de forma
  aproximada. No se publica la ubicación exacta de comunidades.
- La foto es opcional, se comprime en el teléfono y se envía solo con la alerta.
- El panel debe tratarse como información sensible: usa
  `MANGUARE_PANEL_PASSWORD` y HTTPS antes de cualquier uso real. Sin contraseña
  queda en modo demostración y el servidor lo advierte.
- El acceso de la app con número/PIN es de demostración: las credenciales están
  en el cliente y cualquiera puede leerlas. No protege datos ni reemplaza cuentas
  reales; para un piloto hay que implementar autenticación en el servidor.
- El login no debe bloquear una emergencia real: antes del piloto hay que definir
  un modo invitado o una sesión persistente.
- La sesión del panel vive en memoria: un reinicio cierra las sesiones. No hay
  roles ni historial de auditoría independiente de la alerta.
- Awajún y Shawi aparecen como **Pendiente**: no se inventan traducciones ni
  voces sintéticas. Los textos y audios deben ser validados/grabados por
  hablantes de las comunidades.
- No se ha probado en Android de gama baja ni con la app cerrada durante horas;
  el sistema puede limitar la sincronización en segundo plano. El protocolo de
  prueba está en [`docs/PRUEBAS.md`](docs/PRUEBAS.md).
- El SMS es un respaldo de demostración, no un canal confirmado.

## Contexto del proyecto

El alcance y las decisiones originales están en [`HANDOFF.md`](HANDOFF.md). La
propuesta académica está en `DevUT_proyecto_APA7.pdf` y la guía de entrevista en
`Guia_entrevista_sociologo_DevUT.pdf`.
