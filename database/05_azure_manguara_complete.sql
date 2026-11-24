-- Manguaré | esquema completo para Azure SQL Database manguara_bd.

-- Generado desde 02_azure_sql.sql y 03_azure_app_state.sql.

-- Crea objetos faltantes y catálogos; no elimina ni sobrescribe datos existentes.

-- Las cuentas demo viven en la app. No se inventan usuarios, centros ni alertas.

-- Si ya existe una tabla incompatible, revisar su esquema antes de continuar.

IF DB_NAME() <> N'manguara_bd'

    THROW 51030, 'Conectar a manguara_bd antes de ejecutar este script.', 1;

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

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.emergencias') AND name = N'IX_emergencias_usuario_fecha')
        CREATE INDEX IX_emergencias_usuario_fecha ON dbo.emergencias(usuario_id,recibida_servidor_utc DESC);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.emergencias') AND name = N'IX_emergencias_centro_estado_fecha')
        CREATE INDEX IX_emergencias_centro_estado_fecha ON dbo.emergencias(centro_salud_id,estado,recibida_servidor_utc DESC);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.emergencias') AND name = N'IX_emergencias_centro_actualizada')
        CREATE INDEX IX_emergencias_centro_actualizada ON dbo.emergencias(centro_salud_id,actualizada_servidor_utc DESC,id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.centros_salud') AND name = N'IX_centros_comunidad')
        CREATE INDEX IX_centros_comunidad ON dbo.centros_salud(comunidad_id);

    COMMIT;

END TRY

BEGIN CATCH

    IF XACT_STATE() <> 0 ROLLBACK;

    THROW;

END CATCH;



EXEC(N'CREATE OR ALTER PROCEDURE dbo.usp_registrar_emergencia
 @id uniqueidentifier, @usuario_id uniqueidentifier, @tipo_codigo varchar(20),
 @creada_dispositivo_utc datetime2(3), @comunidad_id uniqueidentifier=NULL,
 @centro_salud_id uniqueidentifier=NULL, @descripcion nvarchar(1000)=NULL,
 @referencia_ubicacion nvarchar(250)=NULL, @latitud decimal(9,6)=NULL,
 @longitud decimal(9,6)=NULL, @reporta_por_tercero bit=0
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE id=@usuario_id AND activo=1 AND rol IN (''RESIDENTE'',''PROMOTOR''))
   THROW 51001, ''Usuario no autorizado para registrar.'', 1;
  DECLARE @dueno uniqueidentifier;
  SELECT @dueno=usuario_id FROM dbo.emergencias WITH (UPDLOCK,HOLDLOCK) WHERE id=@id;
  IF @dueno IS NOT NULL AND @dueno<>@usuario_id
   THROW 51002, ''Identificador no disponible.'', 1;
  IF @dueno IS NULL
  BEGIN
   IF @centro_salud_id IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.centros_salud WHERE id=@centro_salud_id AND activo=1)
    THROW 51003, ''Centro no disponible. Revisar destino.'', 1;
   DECLARE @ahora datetime2(3)=SYSUTCDATETIME();
   INSERT dbo.emergencias(id,usuario_id,comunidad_id,centro_salud_id,tipo_codigo,descripcion,referencia_ubicacion,latitud,longitud,reporta_por_tercero,creada_dispositivo_utc,recibida_servidor_utc,actualizada_servidor_utc)
    VALUES(@id,@usuario_id,@comunidad_id,@centro_salud_id,@tipo_codigo,@descripcion,@referencia_ubicacion,@latitud,@longitud,@reporta_por_tercero,@creada_dispositivo_utc,@ahora,@ahora);
   INSERT dbo.historial_estados(id,emergencia_id,estado,fecha_utc,version,actor_usuario_id)
    VALUES(NEWID(),@id,''ENVIADA'',@ahora,1,@usuario_id);
  END;
  COMMIT;
  SELECT * FROM dbo.emergencias WHERE id=@id AND usuario_id=@usuario_id;
  SELECT id,emergencia_id,estado,fecha_utc,version FROM dbo.historial_estados WHERE emergencia_id=@id ORDER BY version;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
 END CATCH
END;');

EXEC(N'CREATE OR ALTER PROCEDURE dbo.usp_cambiar_estado
 @emergencia_id uniqueidentifier, @actor_usuario_id uniqueidentifier,
 @nuevo_estado varchar(15), @evento_id uniqueidentifier, @version_esperada int
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @estado varchar(15), @centro uniqueidentifier, @version int, @rol varchar(12);
  SELECT @estado=estado,@centro=centro_salud_id,@version=version_servidor FROM dbo.emergencias WITH (UPDLOCK,HOLDLOCK) WHERE id=@emergencia_id;
  SELECT @rol=rol FROM dbo.usuarios WHERE id=@actor_usuario_id AND activo=1;
  IF @estado IS NULL OR @rol IS NULL OR @rol NOT IN (''RECEPTOR'',''ADMIN'')
   THROW 51004, ''Emergencia no disponible o usuario no autorizado.'', 1;
  IF @centro IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.usuarios_centros WHERE usuario_id=@actor_usuario_id AND centro_salud_id=@centro AND activo=1)
   THROW 51005, ''El receptor no tiene acceso al centro asignado.'', 1;
  IF EXISTS (SELECT 1 FROM dbo.historial_estados WHERE id=@evento_id)
  BEGIN
   IF NOT EXISTS (SELECT 1 FROM dbo.historial_estados WHERE id=@evento_id AND emergencia_id=@emergencia_id AND actor_usuario_id=@actor_usuario_id AND estado=@nuevo_estado)
    THROW 51006, ''Identificador de evento en conflicto.'', 1;
  END
  ELSE
  BEGIN
   IF @version_esperada IS NULL OR @version<>@version_esperada
    THROW 51007, ''Version desactualizada. Volver a consultar.'', 1;
   IF @nuevo_estado IS NULL OR NOT ((@estado=''ENVIADA'' AND @nuevo_estado=''RECIBIDA'') OR (@estado=''RECIBIDA'' AND @nuevo_estado=''EN_ATENCION'') OR (@estado=''EN_ATENCION'' AND @nuevo_estado=''ATENDIDA''))
    THROW 51008, ''Transicion de estado no permitida.'', 1;
   DECLARE @ahora datetime2(3)=SYSUTCDATETIME();
   UPDATE dbo.emergencias SET estado=@nuevo_estado,version_servidor=@version+1,
     actualizada_servidor_utc=@ahora,
     confirmada_receptor_utc=CASE WHEN @nuevo_estado=''RECIBIDA'' THEN @ahora ELSE confirmada_receptor_utc END
    WHERE id=@emergencia_id;
   INSERT dbo.historial_estados(id,emergencia_id,estado,fecha_utc,version,actor_usuario_id)
    VALUES(@evento_id,@emergencia_id,@nuevo_estado,@ahora,@version+1,@actor_usuario_id);
  END;
  COMMIT;
  SELECT * FROM dbo.emergencias WHERE id=@emergencia_id;
  SELECT id,emergencia_id,estado,fecha_utc,version FROM dbo.historial_estados WHERE emergencia_id=@emergencia_id ORDER BY version;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
 END CATCH
END;');

EXEC(N'CREATE OR ALTER PROCEDURE dbo.usp_consultar_emergencia
 @id uniqueidentifier,@usuario_id uniqueidentifier
AS
BEGIN
 SET NOCOUNT ON;
 IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE id=@usuario_id AND activo=1)
  THROW 51009, ''Usuario no autorizado.'', 1;
 SELECT * FROM dbo.emergencias WHERE id=@id AND usuario_id=@usuario_id;
 SELECT h.id,h.emergencia_id,h.estado,h.fecha_utc,h.version
 FROM dbo.historial_estados h JOIN dbo.emergencias e ON e.id=h.emergencia_id
 WHERE e.id=@id AND e.usuario_id=@usuario_id ORDER BY h.version;
END;');

EXEC(N'CREATE OR ALTER PROCEDURE dbo.usp_listar_emergencias_centro
 @actor_usuario_id uniqueidentifier,@centro_salud_id uniqueidentifier,
 @limite int=100,@antes_fecha datetime2(3)=NULL,@antes_id uniqueidentifier=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @limite IS NULL OR @limite NOT BETWEEN 1 AND 200 OR
    (@antes_fecha IS NULL AND @antes_id IS NOT NULL) OR (@antes_fecha IS NOT NULL AND @antes_id IS NULL)
  THROW 51010, ''Paginacion no valida.'', 1;
 IF NOT EXISTS (SELECT 1 FROM dbo.usuarios u JOIN dbo.usuarios_centros c ON c.usuario_id=u.id
 WHERE u.id=@actor_usuario_id AND u.activo=1 AND u.rol IN (''RECEPTOR'',''ADMIN'') AND c.centro_salud_id=@centro_salud_id AND c.activo=1)
  THROW 51011, ''Centro no autorizado.'', 1;
 SELECT TOP(@limite) * FROM dbo.emergencias WHERE centro_salud_id=@centro_salud_id
 AND (@antes_fecha IS NULL OR recibida_servidor_utc<@antes_fecha OR (recibida_servidor_utc=@antes_fecha AND id<@antes_id))
 ORDER BY recibida_servidor_utc DESC,id DESC;
END;');

EXEC(N'CREATE OR ALTER PROCEDURE dbo.usp_resolver_usuario
 @auth_subject nvarchar(250)
AS
BEGIN
 SET NOCOUNT ON;
 SELECT id,nombre,comunidad_id,idioma_codigo,rol FROM dbo.usuarios
 WHERE auth_subject=@auth_subject AND activo=1;
END;');



IF DATABASE_PRINCIPAL_ID(N'manguare_api') IS NULL

    CREATE ROLE manguare_api;

GRANT EXECUTE ON dbo.usp_resolver_usuario TO manguare_api;

GRANT EXECUTE ON dbo.usp_registrar_emergencia TO manguare_api;

GRANT EXECUTE ON dbo.usp_cambiar_estado TO manguare_api;

GRANT EXECUTE ON dbo.usp_consultar_emergencia TO manguare_api;

GRANT EXECUTE ON dbo.usp_listar_emergencias_centro TO manguare_api;

GRANT SELECT ON dbo.idiomas TO manguare_api;

GRANT SELECT ON dbo.tipos_emergencia TO manguare_api;

GRANT SELECT ON dbo.comunidades TO manguare_api;

GRANT SELECT ON dbo.centros_salud TO manguare_api;



SELECT DB_NAME() AS base_de_datos,

       (SELECT COUNT(*) FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo') AND name IN

        (N'idiomas', N'comunidades', N'centros_salud', N'usuarios', N'usuarios_centros',

         N'tipos_emergencia', N'emergencias', N'historial_estados', N'manguare_app_state')) AS tablas_presentes,

       (SELECT COUNT(*) FROM dbo.idiomas) AS idiomas,

       (SELECT COUNT(*) FROM dbo.tipos_emergencia) AS tipos_emergencia;



-- Después, con una cuenta administradora Entra, ejecutar 04_azure_identity.sql.

-- La API actual usa dbo.manguare_app_state. El esquema relacional y sus procedimientos

-- quedan preparados, pero no se usan hasta definir identidad y centros reales.
