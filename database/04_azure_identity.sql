-- Ejecutar en manguara_bd con una cuenta administradora Microsoft Entra.
-- Requiere que la identidad administrada del App Service manguare-services esté activa.
-- No modifica cuentas ni contraseñas existentes del panel.
IF DB_NAME() <> N'manguara_bd'
    THROW 51021, 'Conectar a manguara_bd antes de crear el usuario.', 1;

IF OBJECT_ID(N'dbo.manguare_app_state', N'U') IS NULL
    THROW 51022, 'Ejecutar primero 03_azure_app_state.sql en manguara_bd.', 1;

IF DATABASE_PRINCIPAL_ID(N'manguare-services') IS NULL
    CREATE USER [manguare-services] FROM EXTERNAL PROVIDER;

GRANT SELECT, INSERT, UPDATE ON dbo.manguare_app_state TO [manguare-services];
