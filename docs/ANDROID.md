# APK de prueba local con Capacitor

El APK incluye la interfaz y guarda los datos locales en el teléfono. La API Node
y la clave de Gemini permanecen en el PC. **El PC y el teléfono deben estar en la
misma red Wi-Fi** mientras se use Gemini, el panel o la sincronización de alertas.
No hace falta publicar un servidor para este MVP.

## 1. Preparar el servidor en el PC

En la raíz del proyecto, crea un archivo `.env` con esta línea y tu clave real:

```dotenv
GEMINI_API_KEY=tu_clave_de_Google_AI_Studio
```

No envíes la clave por chat ni la incluyas en variables `VITE_`. El archivo `.env`
está ignorado por Git. Si ya existe, añade o actualiza esa línea sin borrar la
configuración que uses para el panel.

En una terminal, ejecuta:

```powershell
npm install
npm start
```

Deja esa terminal abierta. Debe mostrar `Gemini API Key cargada: true` y una
dirección `Red: http://192.168.x.x:8787` (la IP exacta de tu PC puede ser otra).
Desde el navegador **del teléfono**, abre `http://IP-DEL-PC:8787/api/health`;
debe responder con `"ok":true`. Si Windows pregunta por el firewall de Node.js,
permite el acceso en redes privadas. Si no carga, comprueba la IP, la misma Wi-Fi,
el firewall y que el router no tenga aislamiento entre clientes.

## 2. Crear e instalar el APK

Requisitos de compilación: Node.js 22+, Android SDK con plataforma API 36 y JDK
21. En otra terminal, desde la raíz del proyecto:

```powershell
npm run android:apk
```

El APK se genera en `android/app/build/outputs/apk/debug/app-debug.apk`. Es una
compilación de prueba firmada con la clave de depuración; se puede copiar al
teléfono e instalar. La app usa `http://localhost` **solo como origen interno del
WebView**. La conexión al PC se hace con la IP privada indicada por `npm start`.

En el APK, abre **Ajustes → Servidor de Manguaré**, escribe
`http://IP-DEL-PC:8787` (sin `/api`, sin barra final y sin `localhost`) y pulsa
**Guardar y comprobar Gemini**. El mensaje **Servidor y Gemini listos** confirma
que la app pudo consultar la API y obtener un token temporal real. Vuelve al
agente y pulsa **Iniciar conversación**.

Si aparece **Falta configurar GEMINI_API_KEY**, revisa `.env` y reinicia
`npm start`. Si no se puede conectar, abre primero `/api/health` desde el
navegador del teléfono; así se distingue un problema de red de uno de Gemini.

## Alcance de esta compilación

`npm run android:apk` habilita HTTP de red privada **solo para el APK de prueba**.
El manifiesto Android permite tráfico HTTP únicamente en la variante `debug`.
`npm run android:sync` vuelve a compilar con el esquema HTTPS normal para una
futura versión publicada. El servidor acepta los orígenes internos exactos de
Capacitor `http://localhost` y `https://localhost` en las rutas `/api/`.

La clave de Gemini nunca se empaqueta en el APK. El servidor solicita un token
temporal y el teléfono lo usa para Gemini Live. La voz requiere internet desde
el teléfono y desde el PC, además de la red local entre ambos. La guía oficial
de tokens temporales está en
[Google AI](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens).

Este APK es para una demostración en una red local confiable: las peticiones al
PC viajan por HTTP. Para distribuir la app fuera de esa red, publica la API con
HTTPS, configura la URL pública y firma una versión de distribución. Antes de
usar el APK con personas, verifica en un Android físico los permisos de GPS,
micrófono y cámara, el envío de alertas y una conversación de voz completa.
