# Diagnóstico de integración con Azure (24 de noviembre de 2026)

> Este documento describe el estado antes de la vinculación. La implementación posterior se explica en [AZURE_SQLITE.md](AZURE_SQLITE.md).

## Estado comprobado en el proyecto

Manguare tiene una PWA React/Vite en TypeScript, un APK Android con Capacitor y una API HTTP en Node.js (Node >= 22). La API sirve también la PWA y el panel. El servidor usa `PORT` y escucha en `0.0.0.0`; el frontend web usa rutas `/api` relativas y Android usa una URL base HTTPS configurable.

En Android, `database/01_sqlite.sql` es **idéntico** al archivo proporcionado. El código crea además `app_alertas`, `app_usuarios`, `app_biodiversidad` y `app_meta` para conservar campos que el esquema original no tiene. La PWA usa IndexedDB. Las alertas se guardan localmente antes del envío y se reintentan al recuperar conectividad. La API aún persiste alertas, biodiversidad y datos sociales en archivos JSON; `server/src/azure-sql.js` es un conector preparado que no se invoca desde `server/src/index.js`.

El proyecto incluye `database/02_azure_sql.sql`: define idiomas, comunidades, centros de salud, usuarios, asignaciones de usuarios a centros, tipos de emergencia, emergencias e historial; procedimientos para registrar, consultar, cambiar estado, listar por centro y resolver usuarios; y el rol `manguare_api`. No se verificó si el script está ejecutado en `manguara_bd`. El script indica que se ejecute una vez en una base nueva y contiene `CREATE TABLE` y `CREATE ROLE` sin comprobación de existencia. No corresponde aplicarlo a ciegas en la base actual.

## Usuarios y permisos actuales

| Acceso | Origen y rol | Capacidades actuales | Restricciones |
| --- | --- | --- | --- |
| Juan (demo, teléfono terminado en 275) | `DEMO_ACCOUNTS`, `user` | Usa la app, crea alertas y reportes ambientales, consulta su historial local. | No ve el enlace del panel ni la capacidad de agente del panel. Comunidad y Red están deshabilitadas. |
| Admin (demo, teléfono terminado en 321) | `DEMO_ACCOUNTS`, `admin` | Capacidades anteriores; ve el enlace y la capacidad del panel. | El panel requiere **además** su propia sesión de servidor cuando está protegido. Comunidad y Red están deshabilitadas. |
| Cuenta registrada en el dispositivo | `localStorage`, siempre `user` | Las mismas funciones de app del rol `user`. | No obtiene rol de panel; su cuenta y PIN no existen en el servidor. |
| Usuario del panel | Variable `MANGUARE_PANEL_USER` y contraseña configurada en el servidor | Puede listar, confirmar y responder alertas, consultar estadísticas y exportar Excel. | Es una identidad separada de las cuentas de la app; las sesiones se guardan en memoria. |

El PIN demo y el registro de cuentas se validan en el cliente; el rol de la sesión también se lee de `localStorage`. Por eso esas credenciales no constituyen una identidad verificada para autorizar consultas o escrituras en Azure SQL. La API protege algunas lecturas y cambios de estado con la cookie del panel, pero `POST /api/alerts` y `POST /api/biodiversity` no autentican al emisor. `GET /api/alerts/:id` permite consultar por ID. En rutas sociales, `x-manguare-phone` es un valor proporcionado por el cliente. Publicar la API tal como está no establecería permisos por usuario o centro.

## Centros y correspondencia de datos

`web/src/lib/community.ts` contiene tres centros visibles como marcadores **de demostración**. Sus identificadores de texto no son UUID ni registros comprobados en Azure. Las alertas actuales contienen `community` como texto libre, pero no llevan `centro_salud_id` ni un destino asignado. La API actual lista las alertas globalmente para el panel.

El procedimiento SQL de registro exige un usuario `RESIDENTE` o `PROMOTOR` activo con identidad verificada y un centro activo. El cambio de estado exige un `RECEPTOR` o `ADMIN` asignado a ese centro. No hay en el proyecto una regla real de selección de centro, ni una correspondencia entre las dos cuentas demo, el login del panel y `dbo.usuarios.auth_subject`.

El contrato actual de alertas incluye SOS, token de edición, foto, teléfono/nombre de quien reporta, plazo de confirmación, escalamiento y respuestas. El esquema remoto v1 no contiene todos esos campos ni tablas equivalentes. La API también ofrece biodiversidad y datos sociales, ausentes del SQL v1. La persistencia JSON actual y el modelo SQL no son intercambiables directamente. Se necesita un diseño de migración no destructivo y una decisión de almacenamiento para cada función.

## App Service y conexión

Los datos proporcionados indican App Service `manguare-services`, Linux, Java 21 / Java SE y Managed Identity de sistema habilitada; Azure SQL `sql-kuska-fadc.database.windows.net`, base `manguara_bd` (nombre confirmado posteriormente por el usuario). El backend real es Node.js. El runtime Java configurado no corresponde a `npm start`; se debe configurar un runtime Node compatible o usar la imagen Node del `Dockerfile`, tras decidir la opción de despliegue. El proyecto ya tiene `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, puerto y autenticación `azure-active-directory-default` como parámetros previstos, pero no hay conexión activa ni comprobación de permisos real.

La cuenta de administrador SQL compartida sirve para administración controlada; la API debería usar la identidad administrada y permisos mínimos (`manguare_api`). Esto requiere un administrador Microsoft Entra del servidor SQL y crear el usuario de la Managed Identity dentro de la base. No se ha ejecutado ninguna acción en Azure ni se han usado credenciales en el código.

## Secuencia de implementación propuesta

1. Obtener una exportación de solo lectura del esquema y de los nombres de tablas de `manguara_bd`; verificar si `02_azure_sql.sql` ya se ejecutó y si hay datos. No ejecutar el script completo sobre la base existente sin revisar su estado.
2. Definir la identidad verificable de la app y la correspondencia exacta con los dos accesos demo, las cuentas locales y el usuario del panel. Mantener los accesos demo solo como demo o establecer un mecanismo de autenticación servidor apropiado para producción; nunca derivar el rol de un campo enviado por el cliente.
3. Proporcionar la lista real de centros, sus UUID, la regla de asignación de cada alerta y la asignación del usuario del panel a sus centros. Los tres marcadores demo no deben convertirse automáticamente en centros de producción.
4. Extender el modelo remoto de forma aditiva para conservar el contrato actual (SOS, edición, foto, respuestas, plazo y escalamiento), y decidir la persistencia de biodiversidad. Comunidad y Red permanecen inaccesibles por la decisión de producto actual.
5. Implementar un repositorio Azure SQL detrás de la API, con consultas parametrizadas/procedimientos, transacciones e idempotencia por UUID; adaptar la sincronización y el panel a permisos por identidad y centro. Mantener SQLite/IndexedDB y la cola local durante el cambio.
6. Probar migración, reintentos, permisos, login, alertas y recuperación de datos con una base de prueba; después configurar el runtime Node o contenedor, variables de App Service, identidad administrada y permisos SQL, y desplegar cuando se autorice.

## Archivos principales que cambiarían

- `server/src/index.js`, `server/src/app.js`, `server/src/auth.js` y nuevos repositorios SQL.
- `database/02_azure_sql.sql` mediante migraciones aditivas revisadas; `server/src/azure-sql.js` para el arranque real.
- `web/src/lib/session.ts`, `web/src/lib/queue-core.ts`, `web/src/lib/types.ts` y pantallas de envío/panel para identidad y destino.
- `web/src/lib/db-native.ts` y una migración SQLite si aparecen nuevos campos locales; `database/01_sqlite.sql` original se conserva como referencia.
- `Dockerfile`, `package.json`, `.env.example` y documentación de despliegue según el runtime elegido.

## Verificación local

`npm.cmd run check`: typecheck correcto, 45 pruebas API y 68 pruebas web aprobadas, compilación PWA correcta. No se ha probado una conexión Azure ni la ejecución del APK en un dispositivo en este diagnóstico.
