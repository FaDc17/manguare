# Pruebas y verificación — Manguaré

Fecha de esta corrida: **2026-11-18**. Entorno: Linux, Node 26.13.1, Chromium
157.0.8103.78 (headless). La verificación en un Android físico sigue pendiente y
se documenta al final.

## 1. Comandos

```bash
npm run check       # typecheck + pruebas de API + pruebas de cola + build
npm run test:e2e    # recorrido completo con Chromium (requiere build)
```

Resultado de `npm run check`:

- TypeScript sin errores.
- 13 pruebas de API/servidor.
- 9 pruebas de la cola offline y del acceso demo.
- Build de app, panel y service worker correcto.

Resultado de `npm run test:e2e`:

```json
{
  "loginMs": 862,
  "greeting": "Hola, Juan · Miembro de la comunidad · 992 066 275",
  "loadMs": 872,
  "navigation": { "domContentLoaded": 598, "load": 599 },
  "offlineState": "Pendiente",
  "persistedAfterReload": true,
  "onlineState": "Enviada",
  "panelReporter": true,
  "panelConfirmed": true,
  "receivedState": "Recibida",
  "idleApiRequestsIn3s": 0,
  "communityData": true,
  "appLogoutWorks": true,
  "logoutWorks": true
}
```

La carga se midió con **CPU 4× más lenta**, descarga 1.5 Mbps y latencia de
120 ms, como aproximación a un equipo de gama baja. No sustituye una prueba en
hardware real.

## 2. Fase 1 — Núcleo offline

| Qué se verifica | Cómo | Resultado |
| --- | --- | --- |
| Cola persistente tras recargar | La alerta se crea sin red y se lee de IndexedDB tras `reload()` | OK |
| ID idempotente | El servidor devuelve la alerta existente al repetir el `POST` | OK (prueba de API) |
| Estado sin retrocesos | `mergeServerState` no baja de `received` y no revive `canceled` | OK |
| Reintentos con espera progresiva | 15 s → 45 s → 2 min → 5 min, con variación | OK |
| Recuperar señal fuerza el envío | Evento `online` y botón manual ignoran la espera | OK (E2E) |
| Anulación solo antes de salir | Una alerta pendiente se anula; una enviada no | OK |
| GPS y foto comprimida | Flujo de 3 pasos; compresión en el teléfono | Verificado en build y E2E de UI |
| Almacenamiento protegido | `navigator.storage.persist()` al iniciar | Implementado; depende del navegador |

## 3. Fase 2 — Sincronización y receptor

| Qué se verifica | Cómo | Resultado |
| --- | --- | --- |
| Backend recibe, guarda y confirma | Pruebas de API con archivo temporal | OK |
| Idempotencia de la confirmación | Repetir `POST /received` no duplica eventos | OK |
| Panel lista, filtra y confirma | E2E con navegador | OK |
| Login y sesión del panel | 401 sin cookie; login; cookie `HttpOnly`; logout invalida | OK |
| Auditoría de la confirmación | `acknowledgedBy` y `events[]` | OK |
| Límite de intentos de login | 429 tras varios fallos por IP | OK |
| Límite de creación de alertas | 120 por 10 min por IP | Implementado |
| La app no descarga toda la lista | Consulta `GET /api/alerts/:id` solo para sus alertas | OK |
| SMS de respaldo | Abre la app de mensajes con texto y número | Prototipo; no confirma entrega |

## 4. Integración del prototipo de Figma

| Qué se verifica | Cómo | Resultado |
| --- | --- | --- |
| Acceso usuario demo | `992066275` + PIN `123456` muestra "Hola, Juan" | OK (E2E) |
| Acceso admin demo | `987654321` + PIN `123456`, enlace al panel | Verificado en pruebas de sesión |
| PIN incorrecto | Se rechaza y se limpia el PIN | OK (prueba unitaria) |
| Persistencia de sesión | Recargar la app mantiene la sesión | OK (E2E) |
| Cierre de sesión | Vuelve a la pantalla de acceso | OK (E2E) |
| Conecta Amazonía | Miel, Transporte fluvial, centros y Alerta Amazonía visibles | OK (E2E) |
| Datos estáticos | Catálogo y centros marcados como demostración | Revisión visual |

> El PIN de la app es un acceso de demostración con credenciales en el cliente.
> No es autenticación real; el panel de la red sí usa contraseña de servidor.

## 5. Fase 3 — Gama baja, red y batería

### Automatizado

- CPU 4× más lenta + red lenta: carga inicial + login **872 ms**.
- Cola vacía: **0 solicitudes API en 3.5 s** (antes se consultaba cada 20 s).
- Con pendientes: reintento cada 20 s; sin pendientes: cada 2 min.
- Cortes de red simulados con Chromium (`Network.emulateNetworkConditions`).
- La app se recarga y la cola sigue en IndexedDB.
- El panel confirma y el teléfono recibe el estado por consulta puntual.

### Matriz de cortes de red

| Escenario | Resultado esperado | Estado |
| --- | --- | --- |
| Modo avión antes de guardar | Alerta queda Pendiente | OK (E2E) |
| Volver la señal | Pasa a Enviada sin duplicar | OK (E2E) |
| Recargar la app sin red | La cola persiste | OK (E2E) |
| Servidor caído | Sigue Pendiente y reintenta | Cubierto por prueba de cola |
| App cerrada y Background Sync | El service worker reintenta al abrir/recibir `sync` | Implementado; requiere Android real |
| Red intermitente | Espera progresiva evita ráfagas | Implementado |
| Confirmación en el panel | El teléfono pasa a Recibida | OK (E2E) |

### Protocolo pendiente en Android físico

Equipos objetivo: 1–2 Android de gama baja (2–3 GB RAM, Android 10 o superior).
Por cada equipo:

1. Instalar la PWA por HTTPS o `localhost` y abrirla una vez con red.
2. **Modo avión:** crear una alerta y comprobar que dice **Pendiente**.
3. **Cerrar la app** (no solo minimizar), esperar 10 minutos y reconectar.
   - Esperado: al abrir, la alerta pasa a **Enviada**. Si Android no ejecuta
     Background Sync, debe enviarse al abrir la app.
4. **Doze / ahorro de batería:** repetir con el equipo bloqueado y sin cargar.
5. **Batería:** con la app abierta y la cola vacía, medir consumo durante 30 min
   (`adb shell dumpsys batterystats` o el medidor del sistema).
   - Esperado: sin sondeo cada 20 s; una consulta cada 2 min como máximo.
6. **Datos:** con la cola vacía, comprobar que el tráfico de la app es mínimo.
7. **Almacenamiento:** llenar parcialmente el teléfono y verificar que la cola
   sobrevive a reinicios; revisar que el navegador no haya desalojado IndexedDB.
8. **Idempotencia:** activar/desactivar el modo avión repetidamente y confirmar
   que el panel muestra una sola alerta por emergencia.
9. **Reloj:** cambiar la hora del equipo y verificar que las marcas de tiempo no
   rompen la cola (la espera progresiva tolera saltos).

Criterio de aceptación: el recorrido completo funciona con la app cerrada durante
al menos 30 minutos y el consumo en reposo es aceptable para un panel solar
pequeño. Registrar modelo, versión de Android, versión de Chrome y resultado.

## 6. Empaquetado y despliegue

- `docker build -t manguare:verify .` completó sin errores.
- Contenedor con volumen persistente y contraseña: `/api/health` → 200,
  `/panel` → 200, `/api/alerts` sin sesión → 401, healthcheck → `healthy`.
- CI de GitHub Actions añadido (`.github/workflows/ci.yml`) con tres trabajos:
  checks, E2E con Chrome y build de la imagen. No se ejecutó en GitHub desde este
  entorno; la corrida local equivale a los comandos del trabajo `checks`.

## 7. Lo que no se pudo probar aquí

- Android físico, Doze, batería real y Background Sync del sistema.
- Entrega real de SMS (el prototipo solo abre la app de mensajes).
- HTTPS con un proxy real (se usó HTTP local).
- Volumen alto de alertas y fotos (el almacén es un JSON).
- Hablantes de Awajún y Shawi (las traducciones siguen marcadas como pendientes).
