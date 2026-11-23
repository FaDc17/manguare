# Auditoría técnica de Manguaré — 22 de noviembre de 2026

Rama: `fix/auditoria-integral`, basada en `feature/estadisticas-informes` (`59922dd`). Esta auditoría cubre la PWA React/Vite, API Node, panel de salud, almacenamiento JSON e IndexedDB, sincronización, estadísticas, exportación y configuración Docker. El PDF anterior `docs/informe-bugs-manguare.pdf` estaba sin seguimiento en Git antes de esta tarea y se dejó intacto.

## Diagnóstico

Se identificaron y corrigieron **12 grupos de fallos verificables**: **3 críticos, 4 altos, 4 medios y 1 bajo**. Hay riesgos pendientes que requieren cambios de protocolo, autenticación, datos o recursos externos. La cobertura de pruebas no permite afirmar que no existan más errores.

| ID | Gravedad | Problema y causa | Corrección y archivos | Comprobación |
| --- | --- | --- | --- | --- |
| C1 | Crítica | Respuestas HTTP 400/403/404 podían marcar publicaciones y anuncios como sincronizados; `settled()` aceptaba errores como entrega. | Solo 2xx confirma escritura; DELETE 404 sigue siendo idempotente. `web/src/lib/social-sync.ts`. | Pruebas nuevas de publicación 400 y anuncio 403 en `web/test/social-sync.test.ts`. |
| C2 | Crítica | Un envío de alerta en curso podía sobrescribir una edición o dejar como anulada una alerta que sí recibió el servidor. | Se vuelve a leer el registro antes y después del POST, se conservan cambios locales y se reconcilia el estado confirmado. `web/src/lib/queue-core.ts`. | Pruebas de fallo con edición simultánea y respuesta positiva después de anular en `web/test/queue.test.ts`. |
| C3 | Crítica | La consulta de estado y el PATCH de detalle SOS podían sobrescribir una edición hecha durante la solicitud. | Se vuelve a leer IndexedDB tras la respuesta y se mantiene `detailsPendingSync` si hubo otra edición. `web/src/lib/queue-core.ts`. | Dos pruebas de concurrencia nuevas en `web/test/queue.test.ts`. |
| A1 | Alta | Un reporte de biodiversidad borrado durante el envío podía reaparecer por una respuesta tardía. | Se comprueba que el reporte siga existiendo y conserve el estado esperado antes de guardar la respuesta. `web/src/lib/biodiversity.ts`. | Prueba de borrado mientras el POST está pendiente en `web/test/biodiversity.test.ts`. |
| A2 | Alta | El modo sin conexión simulado no impedía sincronizar el muro/mercado ni una tarea Background Sync ya registrada. | Las pantallas usan el estado efectivo de conexión; el service worker consulta un marcador compartido y no registra nuevas tareas durante la simulación. `web/src/screens/{CommunityScreen,NetworkScreen}.tsx`, `web/src/lib/sync.ts`, `web/src/app/AppContext.tsx`, `web/src/sw.ts`. | Revisión de rutas de código; E2E comprueba la desconexión real. La simulación del service worker no tiene una prueba automatizada específica. |
| A3 | Alta | En Docker, el archivo social vivía fuera del volumen y se perdía al recrear el contenedor. | `MANGUARE_SOCIAL_FILE=/data/social.json` en Dockerfile/Compose; migración documentada en README y `docs/OPERACION.md`. | Configuración revisada. Docker no estaba instalado en este entorno; no se ejecutó un contenedor. Antes de recrear uno antiguo hay que respaldar su archivo social. |
| A4 | Alta | Un PATCH SOS rechazado podía limpiar la marca pendiente y el botón manual informar que todo estaba al día. | Se conserva la edición pendiente y el error, y `syncAll()` cuenta el fallo. `web/src/lib/queue-core.ts`. | Prueba de HTTP 409 y estado pendiente en `web/test/queue.test.ts`. |
| M1 | Media | Solicitudes de biodiversidad y PATCH SOS podían esperar sin límite; `AbortSignal.timeout` en otras rutas no era compatible con todos los navegadores. | Helper `fetchWithTimeout` con `AbortController`, usado por alertas, biodiversidad y social. `web/src/lib/fetch-timeout.ts` y clientes API. | Prueba de cancelación por plazo en `web/test/biodiversity.test.ts`. El plazo cubre la llamada `fetch`, no un cuerpo de respuesta que se bloquee después de recibir cabeceras. |
| M2 | Media | GET público de una alerta devolvía el hash interno de su token de edición. | La respuesta usa `publicAlert()`. `server/src/app.js`. | Aserción API de que `editTokenHash` no se expone en `server/test/api.test.js`. La alerta aún expone otros datos personales: ver pendientes. |
| M3 | Media | Dos lecturas del mercado completadas fuera de orden podían aplicar una lista vieja y ocultar una publicación reciente. | Se descartan respuestas anteriores a la solicitud más reciente. `web/src/screens/CommunityScreen.tsx`. | Secuencia comprobada por inspección; E2E verifica publicación y detalle normales. Falta una prueba de interfaz que fuerce respuestas invertidas. |
| M4 | Media | Un cambio remoto solo de ubicación o consentimiento no activaba `mergeServerState()`. | Se incluyen ambos campos en la detección de cambios. `web/src/lib/queue-core.ts`. | Prueba de cambio aislado de ubicación en `web/test/queue.test.ts`. |
| B1 | Baja | El texto Asháninka del SOS se cortaba en 320 px por `white-space: nowrap`. | Se permite el salto de línea. `web/src/styles/app.css`. | E2E fallaba antes; ahora mide `scrollWidth=clientWidth=166` y pasa. |

También se corrigió la documentación que afirmaba que `MANGUARE_SESSION_SECRET` conservaba sesiones tras reiniciar. Las sesiones del panel se guardan en memoria y se invalidan al reiniciar, con independencia de ese secreto.

## Verificación

- Estado inicial: `npm run check` aprobaba 41 pruebas API, 44 web, tipos y build; `npm run test:e2e` fallaba por el texto SOS Asháninka.
- Estado final: `npm run check` aprueba **41 pruebas API y 54 web**, TypeScript y build. `npm run test:e2e` aprueba el recorrido en Chromium.
- El E2E cubre alerta sin conexión, persistencia tras recarga, envío al reconectar, confirmación y respuesta del panel, detalle SOS, biodiversidad, mercado, muro, match, asistente, mapa, registro, cierre de sesión e idiomas. Las pruebas API cubren permisos del panel, estadísticas y Excel sin alterar registros.
- `git diff --check` no detectó errores de formato. El build sigue avisando de imágenes ausentes de `/art`.
- `npm audit` detecta cuatro avisos moderados en herramientas de desarrollo/build (`glob`, `minimatch`, `workbox-build`, `vite-plugin-pwa`); `npm audit --omit=dev` detecta cero en dependencias de ejecución.
- No se pudo ejecutar Docker ni comprobar conectividad real de zonas remotas, distintos dispositivos físicos, SMS o carga concurrente de varias instancias. Las pruebas usan datos temporales y no modifican datos reales.

## Riesgos y errores pendientes

1. **Crítico — Datos personales en `GET /api/alerts/:id`.** Cualquiera que conozca un ID puede leer nombre, teléfono, ubicación o foto. Eliminar el hash fue seguro, pero restringir la ruta exige definir cómo se autentica el teléfono y actualizar clientes existentes. Propuesta: credencial por alerta o sesión de usuario validada por el servidor, con migración compatible y prueba de acceso ajeno denegado.
2. **Crítico — PIN local en texto plano y sesión de usuario manipulable.** `web/src/lib/session.ts` guarda cuentas y PIN en `localStorage`; el rol local también puede modificarse. El acceso móvil actual es de demostración. Requiere autenticación real, diseño offline y migración de cuentas; un hash local aislado no resolvería la suplantación del servidor.
3. **Alto — Identidad social suplantable.** La API acepta `x-manguare-phone` como identidad, de modo que conocer otro número permite operar en su nombre. Requiere sesión o token validado en el servidor y adaptación del flujo offline.
4. **Alto — Anulación durante un POST en curso.** La interfaz aún puede mostrar momentáneamente «anulada» antes de que el servidor confirme el envío; la reconciliación final ya corrige el estado. Un bloqueo fiable entre pestaña y service worker necesita una operación atómica de cola o protocolo de cancelación.
5. **Alto si se despliegan varias réplicas — Almacenes JSON sin coordinación entre procesos.** Las escrituras están serializadas dentro de una instancia, pero no entre servidores que compartan archivos. Para varias réplicas se necesita un almacén transaccional o mantener una sola instancia; migrar datos requiere planificación.
6. **Medio — Recursos gráficos ausentes.** Faltan cuatro imágenes y un video bajo `/art`; la portada pierde sus escenas y el build avisa sobre dos imágenes. Se necesitan los archivos originales o recursos aprobados por diseño.
7. **Medio — Cuatro avisos de dependencias de desarrollo.** La corrección automática puede cambiar la cadena PWA/build; requiere actualización dirigida y repetir build/E2E. No se instalaron dependencias masivamente.
8. **Medio — Traducciones indígenas incompletas.** El catálogo usa respaldos en español donde falta texto. Completarlo requiere revisión de hablantes competentes; no se generaron traducciones sin validar.

La arquitectura del MVP deja además los datos locales de alertas e informes en el mismo IndexedDB del navegador, sin separación por cuenta local. Antes de usar dispositivos compartidos con datos reales, se necesita una política de identidad, acceso y migración compatible con el uso sin conexión.
