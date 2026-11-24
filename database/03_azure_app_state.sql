-- Manguaré: persistencia de la API actual en Azure SQL.
-- Migración aditiva. Se puede ejecutar aunque 02_azure_sql.sql no esté aplicado.
-- No modifica ni borra tablas existentes. Ejecutar en manguara_bd.
IF DB_NAME() <> N'manguara_bd'
    THROW 51020, 'Conectar a manguara_bd antes de ejecutar esta migración.', 1;

IF OBJECT_ID(N'dbo.manguare_app_state', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.manguare_app_state (
        name varchar(32) NOT NULL CONSTRAINT PK_manguare_app_state PRIMARY KEY,
        revision bigint NOT NULL CONSTRAINT CK_manguare_app_state_revision CHECK (revision >= 1),
        payload nvarchar(max) NOT NULL,
        updated_utc datetime2(3) NOT NULL CONSTRAINT DF_manguare_app_state_updated DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_manguare_app_state_json CHECK (ISJSON(payload) = 1)
    );
END;
