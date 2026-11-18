# Guion de demostración — 3 minutos

Objetivo: mostrar un solo recorrido completo:

**sin señal → Pendiente → vuelve la señal → Enviada → panel → Recibida**

## Antes de empezar (5 minutos antes)

1. En el laptop:

   ```bash
   npm run build
   npm start
   ```

   En otra terminal, para que el panel no esté vacío:

   ```bash
   npm run seed
   ```

   `npm run seed` es idempotente y necesita el servidor encendido.
   Si quieres mostrar el **plazo vencido** en vivo, arranca con
   `MANGUARE_ACK_MINUTES=1 npm start`.
2. Accesos de demo de la app:
   - Usuario: `992066275` · PIN `123456` (Juan).
   - Admin: `987654321` · PIN `123456` (enlaza al panel).
3. Abre dos ventanas:
   - Laptop: <http://localhost:8787/panel> (panel, a pantalla completa).
   - Teléfono o ventana móvil: <http://localhost:8787> (app).
   Si arrancaste con `MANGUARE_PANEL_PASSWORD`, inicia sesión en el panel antes de
   empezar (usuario `salud`). Déjalo ya abierto para no perder tiempo en vivo.
4. Entra a la app con el acceso de demo y déjala en **Inicio**.
5. Deja el panel en **Todas** y comprueba que dice **En vivo**.
6. Plan B: si la red del lugar falla, usa **Ajustes → Simular sin conexión** en
   la app. No borra alertas y permite mostrar el estado Pendiente igual.

> Si presentas desde el teléfono por la IP de la LAN, usa HTTPS o mantén la
> pestaña abierta: el service worker no se registra por HTTP fuera de localhost.

## Guion

### 0:00–0:25 · Contexto (25 s)

> "En muchas comunidades amazónicas la señal llega por horas o no llega. Una
> emergencia no puede depender de tener internet en ese minuto. Manguaré guarda la
> alerta en el teléfono y la envía sola cuando vuelve la señal."

Señala la app: botón grande de emergencia, indicador de conexión y pendientes.

### 0:25–0:50 · Crear la emergencia (25 s)

1. Toca **Emergencia**.
2. Elige **Enfermedad**.
3. Escribe: `Fiebre alta y dificultad para respirar desde anoche.`
4. Comunidad: `Nueva Esperanza`.
5. Muestra la tarjeta **Ubicación lista** y el check de consentimiento.

> "El GPS funciona sin datos. La ubicación solo se comparte si la persona lo
> autoriza; no se publica la ubicación exacta de la comunidad."

6. Toca **Continuar**.

### 0:50–1:20 · Sin conexión (30 s)

1. Activa el modo avión o **Ajustes → Simular sin conexión**.
2. En la revisión, muestra el aviso de que se guardará en el teléfono.
3. Toca **Guardar alerta**.

> "Queda **Pendiente**. No decimos 'enviada': decimos la verdad. La alerta está
> guardada en este teléfono y saldrá cuando haya señal."

4. Muestra la pantalla de estado y el recorrido de tres pasos.
5. Si hay tiempo, toca **Avisar por SMS**: se abre la app de mensajes con el
   texto listo. Aclara que el SMS no confirma la entrega.

### 1:20–1:50 · Vuelve la señal (30 s)

1. Desactiva el modo avión o el interruptor de simulación.
2. Espera unos segundos (o toca **Actualizar estado**).

> "La cola reintenta sola: rápido al principio y luego cada pocos minutos. El
> identificador es único: aunque se envíe dos veces, no se duplica la alerta."

3. El estado cambia a **Enviada**.

### 1:50–2:30 · Panel de la red de salud (40 s)

1. Pasa al panel. La alerta aparece como **Nueva** / **En plazo**.
2. Abre **Ver detalle** y muestra la nota, la comunidad y la ubicación aproximada.
3. Toca **Marcar recibida**.
4. Envía una respuesta rápida: **“Ambulancia o brigada en camino”**.

> "Acá termina la ambigüedad: la red confirma que recibió la alerta y además le
> dice a la comunidad qué está pasando. Si no confirma en el plazo, el panel la
> marca como vencida y permite escalar por SMS."

### 2:30–3:00 · Cierre (30 s)

1. Vuelve al teléfono y toca **Actualizar estado**.
2. Muestra **Recibida**, la respuesta de la red y el recorrido completo.

> "El MVP demuestra el ciclo completo sin inventar cobertura: guardar sin señal,
> enviar al recuperarla y confirmar la recepción. Lo siguiente es validarlo con
> la comunidad, definir quién responde y probarlo en Android de gama baja. Las
> traducciones y audios en Awajún y Shawi los graban hablantes de las
> comunidades, no una voz sintética."

Si sobra tiempo, muestra **Comunidad → Conecta Amazonía** y **Alerta Amazonía**:
son los datos de demostración del prototipo de Figma, todavía sin contactos ni
reportes reales.

## Frases que conviene evitar

- "La alerta llegó" cuando está Pendiente.
- "El SMS está confirmado": el prototipo no verifica entrega.
- "Funciona en cualquier teléfono": falta la prueba en gama baja.
- "La app reemplaza a la radio o al SAMU": es un complemento.

## Si algo falla

| Problema | Solución rápida |
| --- | --- |
| El panel no muestra la alerta nueva | Pulsa **Actualizar**; revisa que el teléfono diga **Enviada** |
| El teléfono no vuelve a Enviada | Toca **Actualizar estado**; revisa que el servidor siga arriba |
| No hay red para la demo | Usa **Simular sin conexión** y luego desactívalo |
| El panel está vacío | `npm run seed` con el servidor encendido |
| Quieres empezar de cero | Detén el servidor, borra `server/data/alerts.json`, reinicia y `npm run seed` |
| La PWA no se instala en el teléfono | Usa HTTPS o `localhost`; por IP HTTP no hay service worker |

## Reinicio limpio

```bash
# con el servidor detenido
rm -f server/data/alerts.json
npm start
# en otra terminal
npm run seed
```
