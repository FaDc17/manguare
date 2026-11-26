# Publicación de Manguaré en Azure App Service

## Artefacto y proceso

El proyecto ya contiene la API HTTP en `server/src/index.js` (Node.js 22+) y la PWA/panel en `web`. Se despliegan juntos desde la raíz del repositorio. `npm run build` crea `web/dist`; `npm run start:azure` valida el entorno y los archivos compilados y arranca la API en `process.env.PORT`. La web usa rutas `/api` relativas, así que no necesita CORS adicional cuando se publica junto con la API.

El App Service de destino es **manguare-services**, Linux, URL:

`https://manguare-services-c9hpebgcduf0gfdr.eastus2-01.azurewebsites.net`

El runtime Java 21 indicado anteriormente debe cambiarse a **Node.js 22 o posterior** antes de publicar este código. En la configuración del App Service, establecer el comando de inicio en `npm run start:azure`. Para un despliegue de código fuente por ZIP, activar `SCM_DO_BUILD_DURING_DEPLOYMENT=true`: App Service instalará dependencias y ejecutará el script `build` de `package.json`. El proceso Node usa el puerto que entrega App Service en `PORT`.

El ZIP debe conservar en su raíz `package.json` y `package-lock.json`, junto con `database/`, `scripts/`, `server/` y `web/`; no debe tener una carpeta contenedora adicional ni depender de `node_modules` copiado desde otra máquina. El build importa `database/01_sqlite.sql` desde el código web. `mssql` es una dependencia de producción del manifiesto raíz y su entrada debe permanecer en el lockfile. No hay un manifiesto npm separado dentro de `server/`: npm debe instalar desde la raíz para que el módulo esté disponible al importar `server/src/azure-state.js`. Con el build remoto habilitado, App Service instala desde esos manifiestos y ejecuta `npm run build`.

Este App Service usa Linux. La pantalla **Advanced Tools > Zip Push Deploy** de Kudu no admite subir paquetes a App Service en Linux. Subir el ZIP con Azure CLI (`az webapp deploy`) o con la API de publicación de Kudu. Si se usa Cloud Shell, cargar primero el ZIP a Cloud Shell y después ejecutar el comando desde la carpeta donde quedó el archivo:

```bash
APP=manguare-services
RG=$(az webapp list --query "[?name=='$APP'].resourceGroup | [0]" -o tsv)
az webapp config appsettings set --resource-group "$RG" --name "$APP" --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
az webapp deploy --resource-group "$RG" --name "$APP" --src-path ./manguare-azure-app-service-20261126-avisos.zip --type zip
```

Verificar antes que el runtime del App Service sea Node.js 22 o posterior y que el comando de inicio sea `npm run start:azure`. Si el comando de despliegue falla, abrir el registro de implementación en Azure y conservar el mensaje exacto: un ZIP legible puede fallar por permisos, compilación remota, configuración del runtime o inicio de la API.

Para ver el registro de la implementación más reciente desde Azure CLI:

```bash
az webapp log deployment show --resource-group "$RG" --name "$APP"
```

## Base de datos y variables

La API actual usa **dbo.manguare_app_state** en Azure SQL para alertas, biodiversidad y datos sociales. No utiliza todavía los procedimientos relacionales del esquema `02_azure_sql.sql`. El servidor es `sql-kuska-fadc.database.windows.net` y la base confirmada es **manguara_bd**. Si `dbo.manguare_app_state` no existe en esa base, ejecutar `database/03_azure_app_state.sql` conectado a `manguara_bd`. Con una cuenta administradora Microsoft Entra, ejecutar `database/04_azure_identity.sql` para conceder a la identidad administrada `manguare-services` solo `SELECT`, `INSERT` y `UPDATE` en esa tabla.

Configurar los ajustes de aplicación indicados en `config/azure-app-service.env.example`. Las variables `MANGUARE_PANEL_PASSWORD` y `MANGUARE_SESSION_SECRET` deben establecerse con valores reales en App Service; no copiarlas al repositorio. Mantener el usuario y contraseña existentes del panel. `GEMINI_API_KEY` y los contactos de escalamiento son opcionales y se configuran solo si se usan. No agregar el usuario ni la contraseña administrativa de Azure SQL a la aplicación; la conexión usa la identidad administrada.

El filtro de emergencias del Mapa solo aparece al perfil administrador de la app.
Para cargar ubicaciones, el APK reutiliza la sesión autenticada del panel y no pide
credenciales en el Mapa. `GET /api/panel/map-alerts` sigue devolviendo únicamente
ubicaciones compartidas con consentimiento y no expone notas ni teléfonos; sin una
sesión real del panel, el endpoint responde `401`. Mantener
`MANGUARE_SECURE_COOKIES=1`: la cookie segura permite el origen Capacitor exacto,
con credenciales CORS, y las solicitudes de escritura rechazan orígenes ajenos.
Las credenciales del panel no cambian. Publicar esta versión de la API y generar
el APK actualizado para aplicar el cambio.

Si existen archivos JSON de una instalación anterior, conservar copia y ejecutar `npm run azure:import-json` una vez desde un entorno con acceso a esos archivos y a la identidad de Azure SQL. El importador no sobrescribe datos remotos existentes. SQLite/IndexedDB del teléfono se mantiene y envía alertas por la API cuando vuelve la conexión. Biodiversidad y Mercado siguen deshabilitados en la interfaz.

## Comprobación

1. En el entorno de App Service, ejecutar `npm run azure:check`. Comprueba la base `manguara_bd`, la tabla y los permisos mínimos de la identidad que ejecuta la API.
2. Tras publicar, ejecutar desde este repositorio `npm run azure:smoke`. Consulta solo `GET /api/health`, `/api/panel/session`, `/api/alerts`, `/` y `/panel`; exige que el panel esté protegido. El health check realiza una consulta ligera a Azure SQL cuando `MANGUARE_STORAGE=azure-sql`.
3. Configurar `/api/health` como ruta de Health check del App Service si se desea supervisar la dependencia SQL.

El 26 de noviembre de 2026, tras el intento de despliegue por CLI, `npm run azure:smoke` confirmó HTTP 200 en `/api/health`, `/api/panel/session`, `/` y `/panel`, y HTTP 401 en `/api/alerts` sin sesión. El recurso web principal servido por Azure coincidió byte a byte con la compilación hecha desde una extracción limpia del ZIP `manguare-azure-app-service-20261126-avisos.zip`. Esto confirma que la web del paquete está publicada; no identifica por qué la CLI mostró un error ni demuestra el funcionamiento de las notificaciones en un teléfono físico. Ningún script de este repositorio realiza el despliegue automáticamente.
