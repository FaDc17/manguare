# APK Android con Capacitor

El APK incluye la interfaz y conserva los datos y la cola offline en SQLite en el
teléfono. Al compilarlo con `npm run android:apk`, queda preconfigurada la API de
producción:
`https://manguare-services-c9hpebgcduf0gfdr.eastus2-01.azurewebsites.net`.
La URL queda integrada en la compilación, no se muestra en Ajustes y no requiere
configuración del usuario. El servidor y la clave de Gemini permanecen fuera del
APK.

## Crear e instalar el APK

Requisitos de compilación: Node.js 22+, Android SDK con plataforma API 36 y JDK
21. Desde la raíz del proyecto, ejecuta:

```powershell
npm run android:apk
```

El APK se genera en `android/app/build/outputs/apk/debug/app-debug.apk`. Es una
compilación de prueba firmada con la clave de depuración; se puede copiar al
teléfono e instalar. Al abrir la app, la URL de producción se usa automáticamente.
Para comprobar el servidor desde el navegador del teléfono, abre
`https://manguare-services-c9hpebgcduf0gfdr.eastus2-01.azurewebsites.net/api/health`;
debe responder `{"ok":true}`. La función de voz requiere además que Gemini esté
configurado en el backend.

También se puede comprobar en un teléfono conectado a internet creando una alerta
de prueba: se guarda primero localmente y debe pasar de pendiente a enviada al
sincronizar. Sin internet la alerta permanece en SQLite y en la cola, y se reintenta
cuando vuelve la conexión. El teléfono nunca se conecta directamente a Azure SQL;
la sincronización se hace a través de la API.

El filtro **Emergencias** del Mapa aparece para el perfil administrador y requiere
iniciar sesión con las credenciales del panel de salud. La app usa un token de
solo lectura, temporal (30 minutos), que no se guarda en SQLite ni en el
almacenamiento del navegador. El servidor debe tener configurado
`MANGUARE_PANEL_PASSWORD` y estar actualizado con las rutas del mapa. En la app y
en el panel solo se muestran coordenadas válidas que la persona autorizó
compartir; no se muestran notas ni teléfonos en los marcadores.

Para comprobar la ubicación sin internet en Android, concede el permiso de
ubicación precisa y mantén activo el GPS (el modo avión puede usarse si no apaga
los servicios de ubicación). La app intenta obtener una ubicación reciente durante
unos segundos, pero puedes guardar la emergencia mientras el GPS sigue buscando.
Si aún no hay coordenadas, la alerta se guarda sin ellas y lo indica en el detalle;
si el GPS las obtuvo, se guardan junto a la alerta local.

## Conexión local de prueba y seguridad

`npm run android:apk` habilita HTTP de red privada **solo para el APK de prueba**.
La base de producción sigue siendo HTTPS. Para probar un servidor local, configura
`VITE_API_BASE_URL` antes de compilar; el APK local también admite
`http://IP-PRIVADA:8787` en la misma red. No uses `localhost` como dirección del
servidor ni publiques un APK compilado con una URL de pruebas.
`npm run android:sync` no establece una URL de producción por sí mismo y conserva
el esquema HTTPS normal. El servidor acepta los orígenes internos exactos de
Capacitor `http://localhost` y `https://localhost` en las rutas `/api/`.

La clave de Gemini nunca se empaqueta en el APK. El servidor solicita un token
temporal y el teléfono lo usa para Gemini Live. La voz requiere internet desde
el teléfono y un backend con Gemini configurado. La guía oficial de tokens
temporales está en
[Google AI](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens).

El APK generado es de depuración. Antes de distribuir una versión de producción,
firma un build de release y verifica en un Android físico los permisos de GPS,
micrófono y cámara, el envío de alertas y la sincronización al recuperar conexión.
