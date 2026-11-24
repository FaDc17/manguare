-- Manguaré: únicamente tablas y datos de catálogo para una base Azure SQL vacía.

-- También sirve si se borraron solo las filas y se conservaron las tablas.

-- Ejecutar en la base seleccionada en el editor. No comprueba ni cambia su nombre.

-- No crea cuentas de usuario, centros o alertas ficticias.

SET XACT_ABORT ON;

BEGIN TRY

    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.idiomas', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.idiomas (
         codigo varchar(12) NOT NULL PRIMARY KEY, nombre nvarchar(50) NOT NULL
        );
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.idiomas WHERE codigo = 'es')
        INSERT dbo.idiomas(codigo, nombre) VALUES ('es', N'Español');

    IF NOT EXISTS (SELECT 1 FROM dbo.idiomas WHERE codigo = 'agr')
        INSERT dbo.idiomas(codigo, nombre) VALUES ('agr', N'Awajún');

    IF NOT EXISTS (SELECT 1 FROM dbo.idiomas WHERE codigo = 'cbt')
        INSERT dbo.idiomas(codigo, nombre) VALUES ('cbt', N'Shawi');

    IF OBJECT_ID(N'dbo.comunidades', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.comunidades (
         id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
         nombre nvarchar(150) NOT NULL, departamento nvarchar(100) NULL,
         provincia nvarchar(100) NULL, distrito nvarchar(100) NULL,
         idioma_codigo varchar(12) NOT NULL REFERENCES dbo.idiomas(codigo),
         activo bit NOT NULL DEFAULT 1
        );
    END;

    IF OBJECT_ID(N'dbo.centros_salud', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.centros_salud (
         id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
         nombre nvarchar(150) NOT NULL, comunidad_id uniqueidentifier NULL REFERENCES dbo.comunidades(id),
         telefono nvarchar(40) NULL, latitud decimal(9,6) NULL, longitud decimal(9,6) NULL,
         activo bit NOT NULL DEFAULT 1,
         CONSTRAINT CK_centros_gps CHECK ((latitud IS NULL AND longitud IS NULL) OR
         (latitud IS NOT NULL AND longitud IS NOT NULL AND latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180))
        );
    END;

    IF OBJECT_ID(N'dbo.usuarios', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.usuarios (
         id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
         auth_subject nvarchar(250) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
         nombre nvarchar(120) NULL, comunidad_id uniqueidentifier NULL REFERENCES dbo.comunidades(id),
         idioma_codigo varchar(12) NOT NULL DEFAULT 'es' REFERENCES dbo.idiomas(codigo),
         rol varchar(12) NOT NULL CHECK(rol IN ('RESIDENTE','PROMOTOR','RECEPTOR','ADMIN')),
         activo bit NOT NULL DEFAULT 1
        );
    END;

    IF OBJECT_ID(N'dbo.usuarios_centros', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.usuarios_centros (
         usuario_id uniqueidentifier NOT NULL REFERENCES dbo.usuarios(id),
         centro_salud_id uniqueidentifier NOT NULL REFERENCES dbo.centros_salud(id),
         activo bit NOT NULL DEFAULT 1,
         PRIMARY KEY(usuario_id,centro_salud_id)
        );
    END;

    IF OBJECT_ID(N'dbo.tipos_emergencia', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.tipos_emergencia (
         codigo varchar(20) NOT NULL PRIMARY KEY, nombre nvarchar(60) NOT NULL
        );
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.tipos_emergencia WHERE codigo = 'ENFERMEDAD')
        INSERT dbo.tipos_emergencia(codigo, nombre) VALUES ('ENFERMEDAD', N'Enfermedad');

    IF NOT EXISTS (SELECT 1 FROM dbo.tipos_emergencia WHERE codigo = 'ACCIDENTE')
        INSERT dbo.tipos_emergencia(codigo, nombre) VALUES ('ACCIDENTE', N'Accidente');

    IF NOT EXISTS (SELECT 1 FROM dbo.tipos_emergencia WHERE codigo = 'MORDEDURA')
        INSERT dbo.tipos_emergencia(codigo, nombre) VALUES ('MORDEDURA', N'Mordedura');

    IF NOT EXISTS (SELECT 1 FROM dbo.tipos_emergencia WHERE codigo = 'PARTO')
        INSERT dbo.tipos_emergencia(codigo, nombre) VALUES ('PARTO', N'Parto');

    IF NOT EXISTS (SELECT 1 FROM dbo.tipos_emergencia WHERE codigo = 'OTRO')
        INSERT dbo.tipos_emergencia(codigo, nombre) VALUES ('OTRO', N'Otro');

    IF OBJECT_ID(N'dbo.emergencias', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.emergencias (
         id uniqueidentifier NOT NULL PRIMARY KEY, -- mismo UUID que se genera en el celular
         usuario_id uniqueidentifier NOT NULL REFERENCES dbo.usuarios(id),
         comunidad_id uniqueidentifier NULL REFERENCES dbo.comunidades(id),
         centro_salud_id uniqueidentifier NOT NULL REFERENCES dbo.centros_salud(id),
         tipo_codigo varchar(20) NOT NULL REFERENCES dbo.tipos_emergencia(codigo),
         descripcion nvarchar(1000) NULL, referencia_ubicacion nvarchar(250) NULL,
         latitud decimal(9,6) NULL, longitud decimal(9,6) NULL,
         reporta_por_tercero bit NOT NULL DEFAULT 0,
         estado varchar(15) NOT NULL DEFAULT 'ENVIADA' CHECK(estado IN ('ENVIADA','RECIBIDA','EN_ATENCION','ATENDIDA')),
         creada_dispositivo_utc datetime2(3) NOT NULL,
         recibida_servidor_utc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
         confirmada_receptor_utc datetime2(3) NULL,
         actualizada_servidor_utc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
         version_servidor int NOT NULL DEFAULT 1 CHECK(version_servidor>=1),
         CONSTRAINT CK_emergencias_gps CHECK ((latitud IS NULL AND longitud IS NULL) OR
         (latitud IS NOT NULL AND longitud IS NOT NULL AND latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180)),
         CONSTRAINT CK_emergencias_confirmacion CHECK ((estado='ENVIADA' AND confirmada_receptor_utc IS NULL) OR
         (estado IN ('RECIBIDA','EN_ATENCION','ATENDIDA') AND confirmada_receptor_utc IS NOT NULL))
        );
    END;

    IF OBJECT_ID(N'dbo.historial_estados', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.historial_estados (
         id uniqueidentifier NOT NULL PRIMARY KEY,
         emergencia_id uniqueidentifier NOT NULL REFERENCES dbo.emergencias(id),
         estado varchar(15) NOT NULL CHECK(estado IN ('ENVIADA','RECIBIDA','EN_ATENCION','ATENDIDA')),
         fecha_utc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
         version int NOT NULL CHECK(version>=1),
         actor_usuario_id uniqueidentifier NOT NULL REFERENCES dbo.usuarios(id),
         CONSTRAINT UQ_historial_version UNIQUE(emergencia_id,version)
        );
    END;

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

    COMMIT;

END TRY

BEGIN CATCH

    IF XACT_STATE() <> 0 ROLLBACK;

    THROW;

END CATCH;
