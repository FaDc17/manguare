# Publicación de Manguaré en Azure App Service

## Artefacto y proceso

El proyecto ya contiene la API HTTP en `server/src/index.js` (Node.js 22+) y la PWA/panel en `web`. Se despliegan juntos desde la raíz del repositorio. `npm run build` crea `web/dist`; `npm run start:azure` valida el entorno y los archivos compilados y arranca la API en `process.env.PORT`. La web usa rutas `/api` relativas, así que no necesita CORS adicional cuando se publica junto con la API.

El App Service de destino es **manguare-services**, Linux, URL:

`https://manguare-services-c9hpebgcduf0gfdr.eastus2-01.azurewebsites.net`

El runtime Java 21 indicado anteriormente debe cambiarse a **Node.js 22 o posterior** antes de publicar este código. En la configuración del App Service, establecer el comando de inicio en `npm run start:azure`. Para un despliegue de código fuente por ZIP, activar `SCM_DO_BUILD_DURING_DEPLOYMENT=true`: App Service instalará dependencias y ejecutará el script `build` de `package.json`. El proceso Node usa el puerto que entrega App Service en `PORT`.

## Base de datos y variables

La API actual usa **dbo.manguare_app_state** en Azure SQL para alertas, biodiversidad y datos sociales. No utiliza todavía los procedimientos relacionales del esquema `02_azure_sql.sql`. El servidor es `sql-kuska-fadc.database.windows.net` y la base confirmada es **manguara_bd**. Si `dbo.manguare_app_state` no existe en esa base, ejecutar `database/03_azure_app_state.sql` conectado a `manguara_bd`. Con una cuenta administradora Microsoft Entra, ejecutar `database/04_azure_identity.sql` para conceder a la identidad administrada `manguare-services` solo `SELECT`, `INSERT` y `UPDATE` en esa tabla.

Configurar los ajustes de aplicación indicados en `config/azure-app-service.env.example`. Las variables `MANGUARE_PANEL_PASSWORD` y `MANGUARE_SESSION_SECRET` deben establecerse con valores reales en App Service; no copiarlas al repositorio. Mantener el usuario y contraseña existentes del panel. `GEMINI_API_KEY` y los contactos de escalamiento son opcionales y se configuran solo si se usan. No agregar el usuario ni la contraseña administrativa de Azure SQL a la aplicación; la conexión usa la identidad administrada.

Si existen archivos JSON de una instalación anterior, conservar copia y ejecutar `npm run azure:import-json` una vez desde un entorno con acceso a esos archivos y a la identidad de Azure SQL. El importador no sobrescribe datos remotos existentes. SQLite/IndexedDB del teléfono se mantiene y envía alertas por la API cuando vuelve la conexión. Biodiversidad y Mercado siguen deshabilitados en la interfaz.

## Comprobación

1. En el entorno de App Service, ejecutar `npm run azure:check`. Comprueba la base `manguara_bd`, la tabla y los permisos mínimos de la identidad que ejecuta la API.
2. Tras publicar, ejecutar desde este repositorio `npm run azure:smoke`. Consulta solo `GET /api/health`, `/api/panel/session`, `/api/alerts`, `/` y `/panel`; exige que el panel esté protegido. El health check realiza una consulta ligera a Azure SQL cuando `MANGUARE_STORAGE=azure-sql`.
3. Configurar `/api/health` como ruta de Health check del App Service si se desea supervisar la dependencia SQL.

Antes de publicar, la URL proporcionada respondió HTTP 200 en `/`, pero HTTP 404 en `/panel` y `/api/health`. Por tanto, esos endpoints aún no están publicados en ese App Service. Ningún script de este repositorio realiza el despliegue automáticamente.
