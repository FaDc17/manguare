# HANDOFF — Manguaré (MVP)

Última actualización: 2026-11-18

## Contexto
- Proyecto: Manguaré (nombre público; la carpeta local y los PDF originales conservan "DevUT"), aplicativo móvil para comunidades amazónicas aisladas con conectividad intermitente. Desafío ISC 2027, Amazonía Viva (UTP).
- Nombre: el **manguaré** es el tambor amazónico usado para enviar mensajes a distancia; metáfora de la alerta que se transmite cuando se abre la señal. Validar su uso con las comunidades antes de un piloto.
- Ruta: `/home/juang/projects/DevUT`
- Repositorio: <https://github.com/ProgramaGrueso/manguare>
- Documentos existentes:
  - `/home/juang/projects/DevUT/DevUT_proyecto_APA7.pdf` (propuesta: problema, 3 capas, alerta, mercado, ética, sostenibilidad, próximos pasos)
  - `/home/juang/projects/DevUT/Guia_entrevista_sociologo_DevUT.pdf` (guía por secciones A-J, preguntas `[P]` prioritarias, anexo de 12 supuestos C/R/M/N)

## Estado — 2026-11-18

MVP funcional y **fases 1, 2 y 3 completadas en software**. La única parte de la
fase 3 que no se puede cerrar aquí es la prueba en un Android físico de gama
baja; el protocolo está listo en `docs/PRUEBAS.md`.

### Fase 1 — Núcleo offline
- Cola local en IndexedDB que sobrevive a cerrar/recargar la app.
- ID idempotente generado una sola vez; el servidor devuelve la alerta existente
  si se reintenta.
- Estados `Pendiente` → `Enviada` → `Recibida`, sin retrocesos ni falsa
  seguridad. `Anulada` para alertas que todavía no salieron del teléfono.
- Reintentos con espera progresiva (15 s, 45 s, 2 min, 5 min) y reinicio
  inmediato al recuperar conexión o al pedir un intento manual.
- GPS sin datos, foto opcional comprimida, consentimiento de ubicación.
- Puesto de salud y teléfono de contacto configurables en Ajustes y visibles sin
  conexión en **Números de ayuda**.
- Anulación con confirmación desde el detalle.
- `navigator.storage.persist()` para reducir el riesgo de que Android borre la
  cola por falta de espacio.
- Pruebas: 6 casos de cola/estado en `web/test/queue.test.ts`.

### Fase 2 — Sincronización y receptor
- Backend Node sin dependencias, persistencia JSON atómica, validación y
  cabeceras de seguridad.
- Panel web con lista, filtros, detalle, estadísticas, sonido y botón
  **Marcar recibida**.
- **Panel protegido opcional** con `MANGUARE_PANEL_PASSWORD`: login, cookie de
  sesión `HttpOnly`, cierre de sesión y límite de intentos.
- Confirmación auditada con `acknowledgedBy` y `events[]`.
- La app consulta solo sus propias alertas por id; ya no descarga la lista
  completa de la red.
- SMS de respaldo (abre la app de mensajes; no confirma entrega).
- Pruebas: 13 casos de API/sesión, incluida idempotencia, auditoría y 401/429.

### Fase 3 — Gama baja y operación
- Reintentos espaciados y sondeo adaptativo: 20 s solo con pendientes, 2 min sin
  pendientes, y nada mientras la pestaña está oculta.
- Prueba E2E con Chromium: CPU 4× más lenta, red lenta, modo offline, recarga,
  sincronización, login del panel, confirmación y vuelta a `Recibida`.
- Carga inicial medida: **734 ms** con CPU 4×; **0 solicitudes API en 3.5 s** con
  la cola vacía.
- `Dockerfile`, `docker-compose.yml`, `.env.example` y CI de GitHub Actions
  (checks, E2E y build de imagen).
- Documentación de operación, respaldos, HTTPS y protocolo de respuesta en
  `docs/OPERACION.md`; verificación y protocolo Android en `docs/PRUEBAS.md`.

### Decisiones tomadas
- PWA en lugar de app nativa: instala desde el navegador y permite iterar rápido.
- Persistencia en archivo JSON: suficiente para el MVP y sin dependencias. Para
  un piloto conviene base de datos y almacenamiento de fotos.
- El panel queda abierto si no se define contraseña, para no romper la demo; el
  servidor lo advierte. Con contraseña, la sesión vive en memoria.
- Un solo usuario de panel y sin roles; el siguiente paso es cuentas por turno.
- El selector de idioma funciona, pero Awajún y Shawi muestran "Pendiente" y la
  interfaz cae a español. No se inventaron traducciones ni voces sintéticas.
- El SMS abre la app de mensajes con un número de prueba; no confirma entrega.
- Se prefiere espera progresiva antes que reintentar cada 20 s: ahorra batería y
  datos en equipos de gama baja.

### Limitaciones conocidas
- **Falta la prueba en Android físico** (Doze, batería, app cerrada y Background
  Sync). Es el riesgo técnico abierto de la fase 3.
- El panel no debe exponerse sin contraseña ni sin HTTPS.
- Persistencia en un solo JSON; las fotos van en base64 y el archivo se reescribe
  completo en cada cambio.
- Sesiones en memoria: un reinicio cierra todas las sesiones salvo que se fije
  `MANGUARE_SESSION_SECRET` (aun así las sesiones no sobreviven al reinicio).
- Sin roles, asignación de responsables ni historial de auditoría externo.
- No hay notificaciones push: el panel suena solo si está abierto.
- Las traducciones/audios en Awajún y Shawi dependen de hablantes reales.
- Los datos de `server/data/alerts.json` son de demostración.

### Cómo ejecutar
```bash
npm install
npm run build
npm start      # http://localhost:8787  ·  panel en /panel
# en otra terminal, opcional:
npm run seed
```

Panel protegido y Docker:

```bash
MANGUARE_PANEL_PASSWORD='clave-larga' \
MANGUARE_SESSION_SECRET="$(openssl rand -base64 48)" \
npm start

# o
cp .env.example .env
docker compose up -d --build
```

Verificación:

```bash
npm run check      # typecheck + 19 pruebas + build
npm run test:e2e   # recorrido completo con Chromium
```

## MVP = un solo recorrido de demo
Celular sin señal envía emergencia → app la muestra **Pendiente** → al volver la conexión pasa a **Enviada** (→ **Recibida** en el panel web).

### Entra
- Pantalla principal: indicador de conexión y pendientes, selector de idioma, botón Emergencia, íconos + audio
- Emergencia: tipo con íconos (enfermedad, accidente, mordedura, parto, otro), GPS sin datos, foto opcional, envío diferido, anulación
- Estado inequívoco Pendiente/Enviada/Recibida (sin falsa seguridad)
- Sincronización al recuperar señal; SMS de respaldo (prototipo con número de prueba)
- Receptor: panel web protegido con alertas, auditoría y botón "recibida"

### Fuera (fase posterior)
Saberes locales, pagos/comisiones, LoRa (solo evaluar), mercado completo, modo
promotor e implementación en comunidad real.

## Plan por fases
0. **Línea base (días 1-3):** ✅ prototipo y stack revisados; entrevista al sociólogo pendiente de ejecutar.
1. **Núcleo offline (sem 1-2):** ✅ cola persistente, estados con reintentos e ID idempotente, UI, GPS, foto, anulación y pruebas.
2. **Sync y receptor (sem 2-3):** ✅ backend, panel, login opcional, auditoría y SMS de respaldo.
3. **Gama baja (sem 3):** 🟡 automatizado y documentado; falta la prueba en 1-2 Android físicos.
4. **UI/íconos/audio (sem 3-4):** 🟡 UI e íconos listos; audio en castellano listo; Awajún/Shawi esperan hablantes.
5. **Demo y validación (sem 4):** 🟡 guion listo (`docs/DEMO.md`); falta ensayarlo, grabar video y reunirse con mentores.

## Trabajo en paralelo (sin código)
1. Entrevista al sociólogo (validar supuestos 1-12; críticos: 2 punto con señal, 3 SMS, 6 quién recibe la alerta). Pedir contactos de hablantes para audio.
2. Datos públicos INEI, MINSA, OSIPTEL, Ministerio de Cultura (marcar lo no encontrado, no estimar).
3. Benchmark de soluciones existentes (CommCare, etc.).
4. Permisos y consulta (Ley 27811, protocolos de ingreso a comunidades).
5. Definir con la red de salud el protocolo de respuesta (ver `docs/OPERACION.md`).

## Riesgos
1. Alerta sin receptor definido → falsa seguridad. Definir a quién llega y qué pasa si nadie responde.
2. Android mata procesos en segundo plano → probar en hardware real (riesgo abierto).
3. Audio en lenguas locales depende de hablantes reales.
4. Ubicación = dato personal: recoger lo mínimo, con consentimiento; no mostrar ubicación exacta de comunidades. El panel ahora puede protegerse, pero no hay roles.

## Pendiente / preguntas abiertas para Juan
- [ ] Fecha límite del Desafío ISC 2027
- [x] Ruta del prototipo y su stack → PWA React 19 + Vite + TypeScript, servidor Node sin dependencias
- [ ] Tamaño del equipo y roles
- [ ] Validar el guion de demo con mentores y definir quién responde las alertas
- [ ] Probar sync en segundo plano, Doze y batería en 1-2 Android de gama baja (protocolo en `docs/PRUEBAS.md`)
- [ ] Definir cuentas por turno y roles del panel antes de un piloto
- [ ] Con las respuestas: actualizar el documento APA con supuestos confirmados/refutados

## Cómo continuar
El recorrido de demo funciona y las fases 1-3 están cerradas en software. Los
siguientes pasos son de validación y operación, no de más funcionalidad:
1. Ejecutar el protocolo de `docs/PRUEBAS.md` en 1-2 Android de gama baja.
2. Validar el guion de `docs/DEMO.md` y grabar un video de respaldo.
3. Conseguir hablantes para textos/audios en Awajún y Shawi.
4. Definir receptor, protocolo de respuesta y cuentas del panel.
5. Actualizar la propuesta con supuestos confirmados/refutados de la entrevista.
