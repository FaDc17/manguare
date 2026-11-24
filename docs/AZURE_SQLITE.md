# Almacenamiento local y preparación de Azure

Para publicar el backend existente en `manguare-services`, seguir [AZURE_DEPLOY.md](AZURE_DEPLOY.md).

## Estado actual

- Android usa SQLite nativo con el esquema recibido en [`database/01_sqlite.sql`](../database/01_sqlite.sql). El tipo, la descripción, la referencia, el estado y los reintentos se leen de `emergencias` y `cola_sincronizacion`. `app_alertas` conserva el registro completo para mantener campos que el esquema no contempla (foto, token de edición, estado cancelado y otros). Los reportes ambientales viven en `app_biodiversidad`.
- Al abrir por primera vez una versión Android actualizada, se copian las alertas y reportes existentes de IndexedDB a SQLite. La migración marca su final solo después de copiar todo y conserva los datos originales para evitar pérdidas. Si falla, se reintenta en el próximo inicio.
- La PWA sigue usando IndexedDB: su service worker no puede abrir SQLite nativo.
- La cola existente envía por HTTPS a la API cuando hay conexión y reintenta al recuperarla. El teléfono nunca se conecta directamente a Azure SQL.

## Azure App Service

La API Node puede ejecutarse en App Service con `npm run start:azure` y el puerto que entregue `PORT` cuando el servicio tenga un runtime Node compatible. Para conectar el APK cuando se publique la API, configura `VITE_API_BASE_URL=https://manguare-services-c9hpebgcduf0gfdr.eastus2-01.azurewebsites.net` al compilarlo, o introdúcela desde Ajustes del teléfono. Para la PWA alojada junto a la API, se mantienen las rutas `/api` relativas. Configura en App Service las variables de `config/azure-app-service.env.example` con los secretos reales en los ajustes del servicio.

## Azure SQL

El esquema recibido está en [`database/02_azure_sql.sql`](../database/02_azure_sql.sql). `server/src/azure-sql.js` prepara una conexión TLS con la identidad administrada de App Service y rechaza un nombre de base distinto de `manguara_bd`. Define `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `AZURE_SQL_PORT=1433` y `AZURE_SQL_AUTHENTICATIONTYPE=azure-active-directory-default`; `npm run azure:check` comprueba la conexión, la tabla y los permisos mínimos.

La API puede usar Azure SQL como almacén remoto al configurar `MANGUARE_STORAGE=azure-sql`. El modo por defecto sigue siendo JSON para el desarrollo local. En modo SQL, los tres almacenes actuales (alertas, biodiversidad y datos sociales) se guardan en `dbo.manguare_app_state`, con revisión optimista para detectar escrituras de otra instancia. Las fotos actuales se conservan en el JSON; `nvarchar(max)` permite guardarlas sin un servicio adicional de imágenes. No se requiere ni se configura una URL externa para fotos. Para volumen alto o varias instancias habrá que migrar estos documentos a tablas por entidad y, si se desea, los archivos a Blob Storage con URL.

Biodiversidad, Mercado, Comunidad y Red están temporalmente inaccesibles desde la app. Los reportes ambientales ya guardados permanecen en el dispositivo; su sincronización automática está pausada mientras Biodiversidad esté deshabilitada. La tabla remota conserva los datos previos de esos módulos si se importan los JSON, sin habilitar sus pantallas.

`database/02_azure_sql.sql` sigue siendo un modelo futuro distinto: sus procedimientos exigen identidad verificada y centros de salud reales, que la app todavía no tiene. La nueva tabla **no altera** esas tablas ni inventa asignaciones. El inicio de sesión del panel sigue usando `MANGUARE_PANEL_USER` y `MANGUARE_PANEL_PASSWORD`; el modo SQL exige que la contraseña del panel esté configurada antes de arrancar.

### Activación en la base existente

1. Comprobar que la conexión del editor SQL está en `manguara_bd`. La API actual solo necesita `dbo.manguare_app_state`: ejecutar [`database/03_azure_app_state.sql`](../database/03_azure_app_state.sql) si esa tabla falta. El esquema relacional de `02` y `05` no está conectado a la API actual y no hace falta ejecutarlo para este despliegue.
2. Con una cuenta administradora Microsoft Entra del servidor SQL, ejecutar [`database/04_azure_identity.sql`](../database/04_azure_identity.sql). Crea el usuario de la identidad administrada `manguare-services` si falta y concede solo `SELECT`, `INSERT` y `UPDATE` en `dbo.manguare_app_state`. El administrador SQL tradicional no sustituye este paso.
3. En la configuración del proceso que ejecutará la API Node, definir `MANGUARE_STORAGE=azure-sql`, `AZURE_SQL_SERVER=sql-kuska-fadc.database.windows.net`, `AZURE_SQL_DATABASE=manguara_bd`, `AZURE_SQL_PORT=1433`, `AZURE_SQL_AUTHENTICATIONTYPE=azure-active-directory-default`, `MANGUARE_PANEL_USER` y la **misma** `MANGUARE_PANEL_PASSWORD` actual, además de `MANGUARE_SESSION_SECRET`. No se pone la contraseña administrativa de Azure SQL en la aplicación.
4. Si hay archivos JSON del servidor con datos previos, conservar una copia y ejecutar **una sola vez** `npm run azure:import-json` desde un entorno con acceso a la base y a esos archivos. El importador omite cualquier almacén que ya tenga datos en Azure SQL; no sobrescribe registros.
5. Verificar la conexión con `npm run azure:check` **desde el App Service**, para comprobar los permisos de su identidad administrada. El comando falla si la base no es `manguara_bd` o falta la tabla o alguno de los permisos `SELECT`, `INSERT`, `UPDATE`. Luego arrancar `npm run start:azure` y probar una alerta y una confirmación del panel. Biodiversidad y Mercado permanecen deshabilitados en la app. El servidor no arranca en modo SQL si no puede cargar la tabla.

El App Service indicado está configurado con Java 21, pero el backend es Node.js. Este cambio prepara la vinculación; para ejecutar la API allí se debe configurar un runtime Node compatible o desplegar la imagen Node del `Dockerfile`. No se ha cambiado ni desplegado el App Service.

Si se borran filas de `manguare_app_state`, se pierden las alertas y reportes guardados por el servidor; el script solo repone catálogos, nunca datos privados. Las cuentas de demostración están definidas en el frontend y sus PIN no se insertan en SQL. Tampoco se insertan centros ni asignaciones de producción sin datos reales.

Referencias: [plugin SQLite de Capacitor](https://github.com/capacitor-community/sqlite), [Azure SQL con Node.js](https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-javascript-mssql-quickstart).
