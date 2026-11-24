-- Manguaré | esquema local v1 | ejecutar en una base nueva.
-- Activar foreign_keys en CADA conexión SQLite, antes de iniciar transacciones.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
CREATE TABLE idiomas (
 codigo TEXT PRIMARY KEY NOT NULL, nombre TEXT NOT NULL
);
INSERT INTO idiomas VALUES ('es','Español'),('agr','Awajún'),('cbt','Shawi');
CREATE TABLE comunidades (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 nombre TEXT NOT NULL CHECK(length(nombre) BETWEEN 1 AND 150),
 departamento TEXT, provincia TEXT, distrito TEXT,
 idioma_codigo TEXT NOT NULL REFERENCES idiomas(codigo),
 activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
);
CREATE TABLE centros_salud (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 nombre TEXT NOT NULL CHECK(length(nombre) BETWEEN 1 AND 150),
 comunidad_id TEXT REFERENCES comunidades(id), telefono TEXT,
 latitud REAL, longitud REAL,
 activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)),
 CHECK ((latitud IS NULL AND longitud IS NULL) OR
        (latitud IS NOT NULL AND longitud IS NOT NULL AND latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180))
);
CREATE TABLE usuarios (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 nombre TEXT CHECK(nombre IS NULL OR length(nombre)<=120),
 comunidad_id TEXT REFERENCES comunidades(id),
 idioma_codigo TEXT NOT NULL DEFAULT 'es' REFERENCES idiomas(codigo),
 rol TEXT NOT NULL CHECK(rol IN ('RESIDENTE','PROMOTOR','RECEPTOR','ADMIN')),
 activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
);
CREATE TABLE tipos_emergencia (
 codigo TEXT PRIMARY KEY NOT NULL, nombre TEXT NOT NULL
);
INSERT INTO tipos_emergencia VALUES ('ENFERMEDAD','Enfermedad'),('ACCIDENTE','Accidente'),('MORDEDURA','Mordedura'),('PARTO','Parto'),('OTRO','Otro');
CREATE TABLE emergencias (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36), -- UUID generado una sola vez en el dispositivo
 usuario_id TEXT NOT NULL REFERENCES usuarios(id),
 comunidad_id TEXT REFERENCES comunidades(id),
 centro_salud_id TEXT REFERENCES centros_salud(id),
 tipo_codigo TEXT NOT NULL REFERENCES tipos_emergencia(codigo),
 descripcion TEXT CHECK(descripcion IS NULL OR length(descripcion)<=1000),
 referencia_ubicacion TEXT CHECK(referencia_ubicacion IS NULL OR length(referencia_ubicacion)<=250),
 latitud REAL, longitud REAL,
 reporta_por_tercero INTEGER NOT NULL DEFAULT 0 CHECK(reporta_por_tercero IN (0,1)),
 estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','ENVIADA','RECIBIDA','EN_ATENCION','ATENDIDA')),
 creada_dispositivo_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 recibida_servidor_utc TEXT,
 confirmada_receptor_utc TEXT,
 actualizada_servidor_utc TEXT,
 version_servidor INTEGER NOT NULL DEFAULT 0 CHECK(version_servidor>=0),
 CHECK ((latitud IS NULL AND longitud IS NULL) OR
        (latitud IS NOT NULL AND longitud IS NOT NULL AND latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180)),
 CHECK ((estado='PENDIENTE' AND version_servidor=0 AND recibida_servidor_utc IS NULL AND confirmada_receptor_utc IS NULL AND actualizada_servidor_utc IS NULL) OR
        (estado='ENVIADA' AND version_servidor>=1 AND recibida_servidor_utc IS NOT NULL AND actualizada_servidor_utc IS NOT NULL AND confirmada_receptor_utc IS NULL) OR
        (estado IN ('RECIBIDA','EN_ATENCION','ATENDIDA') AND version_servidor>=2 AND recibida_servidor_utc IS NOT NULL AND actualizada_servidor_utc IS NOT NULL AND confirmada_receptor_utc IS NOT NULL))
);
-- Historial autorizado, descargado de Azure. PENDIENTE existe solo en la base local.
CREATE TABLE historial_estados (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 emergencia_id TEXT NOT NULL REFERENCES emergencias(id) ON DELETE CASCADE,
 estado TEXT NOT NULL CHECK(estado IN ('ENVIADA','RECIBIDA','EN_ATENCION','ATENDIDA')),
 fecha_utc TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>=1),
 UNIQUE(emergencia_id,version)
);
-- Outbox durable: los datos a enviar están en emergencias, no duplicados en JSON.
CREATE TABLE cola_sincronizacion (
 emergencia_id TEXT PRIMARY KEY NOT NULL REFERENCES emergencias(id) ON DELETE CASCADE,
 intentos INTEGER NOT NULL DEFAULT 0 CHECK(intentos>=0),
 siguiente_intento_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ultimo_error_codigo TEXT CHECK(ultimo_error_codigo IS NULL OR length(ultimo_error_codigo)<=80),
 bloqueada INTEGER NOT NULL DEFAULT 0 CHECK(bloqueada IN (0,1)),
 sincronizada_utc TEXT
);
CREATE TRIGGER tr_emergencia_encolar AFTER INSERT ON emergencias
WHEN NEW.estado='PENDIENTE'
BEGIN
 INSERT INTO cola_sincronizacion(emergencia_id) VALUES(NEW.id);
END;
CREATE TRIGGER tr_emergencia_version BEFORE UPDATE ON emergencias
WHEN NEW.version_servidor < OLD.version_servidor OR
 (OLD.version_servidor>0 AND NEW.version_servidor=OLD.version_servidor AND NEW.estado<>OLD.estado)
BEGIN
 SELECT RAISE(ABORT,'Version de servidor obsoleta');
END;
CREATE INDEX ix_emergencias_usuario_fecha ON emergencias(usuario_id,creada_dispositivo_utc DESC);
CREATE INDEX ix_emergencias_estado ON emergencias(estado);
CREATE INDEX ix_cola_pendientes ON cola_sincronizacion(siguiente_intento_utc) WHERE sincronizada_utc IS NULL AND bloqueada=0;
CREATE INDEX ix_centros_comunidad ON centros_salud(comunidad_id);
CREATE VIEW v_cola_pendiente AS
 SELECT e.*, c.intentos,c.siguiente_intento_utc,c.ultimo_error_codigo
 FROM emergencias e JOIN cola_sincronizacion c ON c.emergencia_id=e.id
 WHERE c.sincronizada_utc IS NULL AND c.bloqueada=0 AND e.estado='PENDIENTE';
PRAGMA user_version = 1;
COMMIT;
