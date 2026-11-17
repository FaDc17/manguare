# HANDOFF — Manguaré (MVP)

Última actualización: 2026-11-17

## Contexto
- Proyecto: Manguaré (nombre público; la carpeta local y los PDF originales conservan "DevUT"), aplicativo móvil para comunidades amazónicas aisladas con conectividad intermitente. Desafío ISC 2027, Amazonía Viva (UTP).
- Nombre: el **manguaré** es el tambor amazónico usado para enviar mensajes a distancia; metáfora de la alerta que se transmite cuando se abre la señal. Validar su uso con las comunidades antes de un piloto.
- Ruta: `/home/juang/projects/DevUT`
- Documentos existentes:
  - `/home/juang/projects/DevUT/DevUT_proyecto_APA7.pdf` (propuesta: problema, 3 capas, alerta, mercado, ética, sostenibilidad, próximos pasos)
  - `/home/juang/projects/DevUT/Guia_entrevista_sociologo_DevUT.pdf` (guía por secciones A-J, preguntas `[P]` prioritarias, anexo de 12 supuestos C/R/M/N)
- El prototipo funcional (offline + sync) que menciona el documento NO está en esta carpeta. Hay que ubicarlo.

## Hecho
- Leídos ambos PDFs y redactado el plan de acción al MVP (abajo).

## Estado del MVP — 2026-11-17

MVP construido y verificado de punta a punta en esta carpeta.

- **App móvil (PWA):** React 19 + Vite + TypeScript, en `web/`. Inicio con
  indicador de conexión y pendientes, selector de idioma, botón grande de
  emergencia, asistente de 3 pasos (tipo → detalles → revisión), GPS sin datos,
  foto opcional comprimida, audio en español, historial y ajustes.
- **Cola offline:** IndexedDB con `id` único generado una sola vez, reintento
  cada 20 s, eventos de conexión/visibilidad, sincronización en segundo plano
  (Background Sync) y envío idempotente (`POST /api/alerts`).
- **Estados:** `Pendiente` → `Enviada` → `Recibida`, sin retrocesos ni falsa
  seguridad. El botón sin conexión dice "Guardar alerta", no "Enviar".
- **Panel web:** `/panel` con estadísticas, filtros, actualización cada 5 s,
  aviso sonoro, detalle y botón "Marcar recibida".
- **Servidor:** Node sin dependencias, persistencia JSON atómica, validación,
  consentimiento de ubicación, cabeceras de seguridad y servicio de la PWA.
- **Pruebas:** `npm run check` pasa (typecheck, 8 pruebas de API y build).
  Recorrido E2E verificado con Playwright (offline real, sync y confirmación).
- **Documentación:** `README.md` (instalación, API, límites) y
  `docs/DEMO.md` (guion de demo de 3 minutos).

### Decisiones tomadas
- PWA en lugar de app nativa: instala desde el navegador y permite iterar rápido
  para la demo. El service worker solo se registra en producción.
- Persistencia en archivo JSON en lugar de base de datos: suficiente para el MVP,
  fácil de reiniciar y sin dependencias.
- El selector de idioma funciona, pero Awajún y Shawi muestran "Pendiente" y la
  interfaz cae a español. No se inventaron traducciones ni voces sintéticas.
- El SMS abre la app de mensajes con un número de prueba; no confirma entrega.
- El panel no tiene autenticación: es una limitación consciente del prototipo.

### Limitaciones conocidas
- El panel no debe exponerse públicamente sin autenticación.
- Falta probar en Android de gama baja, con la app cerrada y batería limitada.
- Por IP de LAN en HTTP no hay service worker (requiere `localhost` o HTTPS).
- No hay notificaciones push, roles, asignación de responsables ni historial de
  auditoría.
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


## MVP = un solo recorrido de demo
Celular sin señal envía emergencia → app la muestra **Pendiente** → al volver la conexión pasa a **Enviada** (→ **Recibida** en el panel web).

### Entra
- Pantalla principal: indicador de conexión y pendientes, selector de idioma, botón Emergencia, íconos + audio
- Emergencia: tipo con íconos (enfermedad, accidente, mordedura, parto, otro), GPS sin datos, foto opcional, envío diferido
- Estado inequívoco Pendiente/Enviada/Recibida (sin falsa seguridad)
- Sincronización al recuperar señal; SMS de respaldo (prototipo con número de prueba)
- Receptor mínimo: panel web con alertas y botón "recibida"

### Fuera (fase posterior)
Saberes locales, pagos/comisiones, LoRa (solo evaluar), mercado completo, implementación en comunidad real. Candidatos a recortar si falta tiempo: modo promotor y mercado.

## Plan por fases
0. **Línea base (días 1-3):** ubicar/revisar prototipo y stack; checklist de "hecho" de la demo; entrevista al sociólogo (preguntas `[P]` + sección J).
1. **Núcleo offline (sem 1-2):** cola local persistente, máquina de estados con reintentos e ID idempotente, UI de estado, GPS offline, foto comprimida.
2. **Sync y receptor (sem 2-3):** backend mínimo (recibir/guardar/confirmar), panel web, SMS de respaldo.
3. **Gama baja (sem 3):** probar sync en segundo plano y batería en 1-2 Android baratos; pruebas de corte de red (modo avión, intermitente, app cerrada).
4. **UI/íconos/audio (sem 3-4):** botón grande, selector de idioma. Audio en castellano como placeholder; NO voces sintéticas en Awajún/Shawi (deben grabarlas hablantes).
5. **Demo y validación (sem 4):** guion de 3 min + video de respaldo; reunión con mentores; actualizar documento con supuestos confirmados/refutados.

## Trabajo en paralelo (sin código)
1. Entrevista al sociólogo (validar supuestos 1-12; críticos: 2 punto con señal, 3 SMS, 6 quién recibe la alerta). Pedirle contactos de hablantes para audio.
2. Datos públicos INEI, MINSA, OSIPTEL, Ministerio de Cultura (marcar lo no encontrado, no estimar).
3. Benchmark de soluciones existentes (CommCare, etc.).
4. Permisos y consulta (Ley 27811, protocolos de ingreso a comunidades).

## Riesgos
1. Alerta sin receptor definido → falsa seguridad. Definir a quién llega y qué pasa si nadie responde.
2. Android mata procesos en segundo plano → probar pronto.
3. Audio en lenguas locales depende de hablantes reales.
4. Ubicación = dato personal: recoger lo mínimo, con consentimiento; no mostrar ubicación exacta de comunidades.

## Pendiente / preguntas abiertas para Juan
- [ ] Fecha límite del Desafío ISC 2027
- [x] Ruta del prototipo y su stack → MVP en esta carpeta: PWA React 19 + Vite + TypeScript, servidor Node sin dependencias
- [ ] Tamaño del equipo y roles
- [ ] Validar el guion de demo con mentores y definir quién responde las alertas
- [ ] Probar sync en segundo plano en 1-2 Android de gama baja
- [ ] Definir autenticación mínima para el panel antes de cualquier piloto
- [ ] Con las respuestas: armar backlog concreto por tareas y revisar qué falta de las fases 1-3

## Cómo continuar
El MVP ya está construido y el recorrido de demo funciona. Los siguientes pasos
son de validación, no de más funcionalidad:
1. Probar en un Android de gama baja (modo avión, app cerrada, batería).
2. Validar el guion de `docs/DEMO.md` con mentores.
3. Conseguir hablantes para textos/audios en Awajún y Shawi.
4. Definir receptor, protocolo de respuesta y autenticación del panel.
5. Actualizar la propuesta con supuestos confirmados/refutados de la entrevista.

