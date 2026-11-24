-- Manguaré | Azure SQL Database | esquema v1.
-- Ejecutar una vez, conectado a manguara_bd solo si esta base está vacía.
-- No ejecutar en master ni sobre una base existente sin una migración revisada.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
CREATE TABLE dbo.idiomas (
 codigo varchar(12) NOT NULL PRIMARY KEY, nombre nvarchar(50) NOT NULL
);
INSERT dbo.idiomas VALUES ('es',N'Español'),('agr',N'Awajún'),('cbt',N'Shawi');
CREATE TABLE dbo.comunidades (
 id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
 nombre nvarchar(150) NOT NULL, departamento nvarchar(100) NULL,
 provincia nvarchar(100) NULL, distrito nvarchar(100) NULL,
 idioma_codigo varchar(12) NOT NULL REFERENCES dbo.idiomas(codigo),
 activo bit NOT NULL DEFAULT 1
);
CREATE TABLE dbo.centros_salud (
 id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
 nombre nvarchar(150) NOT NULL, comunidad_id uniqueidentifier NULL REFERENCES dbo.comunidades(id),
 telefono nvarchar(40) NULL, latitud decimal(9,6) NULL, longitud decimal(9,6) NULL,
 activo bit NOT NULL DEFAULT 1,
 CONSTRAINT CK_centros_gps CHECK ((latitud IS NULL AND longitud IS NULL) OR
 (latitud IS NOT NULL AND longitud IS NOT NULL AND latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180))
);
CREATE TABLE dbo.usuarios (
 id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
 auth_subject nvarchar(250) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
 nombre nvarchar(120) NULL, comunidad_id uniqueidentifier NULL REFERENCES dbo.comunidades(id),
 idioma_codigo varchar(12) NOT NULL DEFAULT 'es' REFERENCES dbo.idiomas(codigo),
 rol varchar(12) NOT NULL CHECK(rol IN ('RESIDENTE','PROMOTOR','RECEPTOR','ADMIN')),
 activo bit NOT NULL DEFAULT 1
);
-- Permisos por establecimiento. No almacenar contraseñas ni tokens en estas tablas.
CREATE TABLE dbo.usuarios_centros (
 usuario_id uniqueidentifier NOT NULL REFERENCES dbo.usuarios(id),
 centro_salud_id uniqueidentifier NOT NULL REFERENCES dbo.centros_salud(id),
 activo bit NOT NULL DEFAULT 1,
 PRIMARY KEY(usuario_id,centro_salud_id)
);
CREATE TABLE dbo.tipos_emergencia (
 codigo varchar(20) NOT NULL PRIMARY KEY, nombre nvarchar(60) NOT NULL
);
INSERT dbo.tipos_emergencia VALUES ('ENFERMEDAD',N'Enfermedad'),('ACCIDENTE',N'Accidente'),('MORDEDURA',N'Mordedura'),('PARTO',N'Parto'),('OTRO',N'Otro');
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
CREATE TABLE dbo.historial_estados (
 id uniqueidentifier NOT NULL PRIMARY KEY,
 emergencia_id uniqueidentifier NOT NULL REFERENCES dbo.emergencias(id),
 estado varchar(15) NOT NULL CHECK(estado IN ('ENVIADA','RECIBIDA','EN_ATENCION','ATENDIDA')),
 fecha_utc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 version int NOT NULL CHECK(version>=1),
 actor_usuario_id uniqueidentifier NOT NULL REFERENCES dbo.usuarios(id),
 CONSTRAINT UQ_historial_version UNIQUE(emergencia_id,version)
);
CREATE INDEX IX_emergencias_usuario_fecha ON dbo.emergencias(usuario_id,recibida_servidor_utc DESC);
CREATE INDEX IX_emergencias_centro_estado_fecha ON dbo.emergencias(centro_salud_id,estado,recibida_servidor_utc DESC);
CREATE INDEX IX_emergencias_centro_actualizada ON dbo.emergencias(centro_salud_id,actualizada_servidor_utc DESC,id);
CREATE INDEX IX_centros_comunidad ON dbo.centros_salud(comunidad_id);
COMMIT;
GO
-- Recibir alerta idempotente. Solo el backend autenticado puede invocar el procedimiento.
-- @usuario_id se deriva de la identidad verificada, nunca de un id arbitrario enviado por el cliente.
CREATE OR ALTER PROCEDURE dbo.usp_registrar_emergencia
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
  IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE id=@usuario_id AND activo=1 AND rol IN ('RESIDENTE','PROMOTOR'))
   THROW 51001, 'Usuario no autorizado para registrar.', 1;
  DECLARE @dueno uniqueidentifier;
  SELECT @dueno=usuario_id FROM dbo.emergencias WITH (UPDLOCK,HOLDLOCK) WHERE id=@id;
  IF @dueno IS NOT NULL AND @dueno<>@usuario_id
   THROW 51002, 'Identificador no disponible.', 1;
  IF @dueno IS NULL
  BEGIN
   IF @centro_salud_id IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.centros_salud WHERE id=@centro_salud_id AND activo=1)
    THROW 51003, 'Centro no disponible. Revisar destino.', 1;
   DECLARE @ahora datetime2(3)=SYSUTCDATETIME();
   INSERT dbo.emergencias(id,usuario_id,comunidad_id,centro_salud_id,tipo_codigo,descripcion,referencia_ubicacion,latitud,longitud,reporta_por_tercero,creada_dispositivo_utc,recibida_servidor_utc,actualizada_servidor_utc)
    VALUES(@id,@usuario_id,@comunidad_id,@centro_salud_id,@tipo_codigo,@descripcion,@referencia_ubicacion,@latitud,@longitud,@reporta_por_tercero,@creada_dispositivo_utc,@ahora,@ahora);
   INSERT dbo.historial_estados(id,emergencia_id,estado,fecha_utc,version,actor_usuario_id)
    VALUES(NEWID(),@id,'ENVIADA',@ahora,1,@usuario_id);
  END;
  COMMIT;
  SELECT * FROM dbo.emergencias WHERE id=@id AND usuario_id=@usuario_id;
  SELECT id,emergencia_id,estado,fecha_utc,version FROM dbo.historial_estados WHERE emergencia_id=@id ORDER BY version;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
 END CATCH
END;
GO
-- Confirmación humana / cambio de estado. El UUID del evento se conserva si se reintenta.
CREATE OR ALTER PROCEDURE dbo.usp_cambiar_estado
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
  IF @estado IS NULL OR @rol IS NULL OR @rol NOT IN ('RECEPTOR','ADMIN')
   THROW 51004, 'Emergencia no disponible o usuario no autorizado.', 1;
  IF @centro IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.usuarios_centros WHERE usuario_id=@actor_usuario_id AND centro_salud_id=@centro AND activo=1)
   THROW 51005, 'El receptor no tiene acceso al centro asignado.', 1;
  IF EXISTS (SELECT 1 FROM dbo.historial_estados WHERE id=@evento_id)
  BEGIN
   IF NOT EXISTS (SELECT 1 FROM dbo.historial_estados WHERE id=@evento_id AND emergencia_id=@emergencia_id AND actor_usuario_id=@actor_usuario_id AND estado=@nuevo_estado)
    THROW 51006, 'Identificador de evento en conflicto.', 1;
  END
  ELSE
  BEGIN
   IF @version_esperada IS NULL OR @version<>@version_esperada
    THROW 51007, 'Version desactualizada. Volver a consultar.', 1;
   IF @nuevo_estado IS NULL OR NOT ((@estado='ENVIADA' AND @nuevo_estado='RECIBIDA') OR (@estado='RECIBIDA' AND @nuevo_estado='EN_ATENCION') OR (@estado='EN_ATENCION' AND @nuevo_estado='ATENDIDA'))
    THROW 51008, 'Transicion de estado no permitida.', 1;
   DECLARE @ahora datetime2(3)=SYSUTCDATETIME();
   UPDATE dbo.emergencias SET estado=@nuevo_estado,version_servidor=@version+1,
     actualizada_servidor_utc=@ahora,
     confirmada_receptor_utc=CASE WHEN @nuevo_estado='RECIBIDA' THEN @ahora ELSE confirmada_receptor_utc END
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
END;
GO
-- Consultar desde el celular: solo registros propios y su historial.
CREATE OR ALTER PROCEDURE dbo.usp_consultar_emergencia
 @id uniqueidentifier,@usuario_id uniqueidentifier
AS
BEGIN
 SET NOCOUNT ON;
 IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE id=@usuario_id AND activo=1)
  THROW 51009, 'Usuario no autorizado.', 1;
 SELECT * FROM dbo.emergencias WHERE id=@id AND usuario_id=@usuario_id;
 SELECT h.id,h.emergencia_id,h.estado,h.fecha_utc,h.version
 FROM dbo.historial_estados h JOIN dbo.emergencias e ON e.id=h.emergencia_id
 WHERE e.id=@id AND e.usuario_id=@usuario_id ORDER BY h.version;
END;
GO
-- Panel: únicamente centros autorizados. Ventana paginada por fecha de recepción e ID.
-- Al reconectar, volver a consultar los registros vigentes; no depender solo de WebSocket.
CREATE OR ALTER PROCEDURE dbo.usp_listar_emergencias_centro
 @actor_usuario_id uniqueidentifier,@centro_salud_id uniqueidentifier,
 @limite int=100,@antes_fecha datetime2(3)=NULL,@antes_id uniqueidentifier=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @limite IS NULL OR @limite NOT BETWEEN 1 AND 200 OR
    (@antes_fecha IS NULL AND @antes_id IS NOT NULL) OR (@antes_fecha IS NOT NULL AND @antes_id IS NULL)
  THROW 51010, 'Paginacion no valida.', 1;
 IF NOT EXISTS (SELECT 1 FROM dbo.usuarios u JOIN dbo.usuarios_centros c ON c.usuario_id=u.id
 WHERE u.id=@actor_usuario_id AND u.activo=1 AND u.rol IN ('RECEPTOR','ADMIN') AND c.centro_salud_id=@centro_salud_id AND c.activo=1)
  THROW 51011, 'Centro no autorizado.', 1;
 SELECT TOP(@limite) * FROM dbo.emergencias WHERE centro_salud_id=@centro_salud_id
 AND (@antes_fecha IS NULL OR recibida_servidor_utc<@antes_fecha OR (recibida_servidor_utc=@antes_fecha AND id<@antes_id))
 ORDER BY recibida_servidor_utc DESC,id DESC;
END;
GO
-- Identificar al usuario a partir del subject verificado por el backend.
CREATE OR ALTER PROCEDURE dbo.usp_resolver_usuario
 @auth_subject nvarchar(250)
AS
BEGIN
 SET NOCOUNT ON;
 SELECT id,nombre,comunidad_id,idioma_codigo,rol FROM dbo.usuarios
 WHERE auth_subject=@auth_subject AND activo=1;
END;
GO
-- Cuenta técnica mínima: conceder este rol solo a la identidad administrada del backend.
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
GO
-- En una sesión de administrador Entra, sustituir por el nombre real de App Service:
-- CREATE USER [NOMBRE_APP_SERVICE] FROM EXTERNAL PROVIDER;
-- ALTER ROLE manguare_api ADD MEMBER [NOMBRE_APP_SERVICE];
-- Provisionar usuarios/centros por un proceso administrativo separado y auditado.
