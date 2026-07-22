-- Schema MySQL para Sistema de Embarques
-- Empacadora Carnes Finas el Andén — TIF No. 680
-- Ejecutar en cPanel > phpMyAdmin o MySQL Databases

CREATE TABLE IF NOT EXISTS usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  usuario       VARCHAR(50)  UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre        VARCHAR(100) NOT NULL,
  rol           ENUM('admin','operador') DEFAULT 'operador',
  activo        TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS productos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  codigo      VARCHAR(20)  NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  tipo_ganado VARCHAR(50)  DEFAULT 'Ambos',
  activo      TINYINT(1)  DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lotes (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  numero           VARCHAR(50)  NOT NULL,
  fecha            DATE         NOT NULL,
  fecha_sacrificio DATE,
  tipo_ganado      VARCHAR(50),
  romaneaje        VARCHAR(100),
  romaneaje_pdf    VARCHAR(255),
  observaciones    TEXT
);

CREATE TABLE IF NOT EXISTS canales (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  lote_id       INT            NOT NULL,
  consecutivo   INT            NOT NULL,
  tipo          VARCHAR(50),
  peso_caliente DECIMAL(10,2),
  peso_frio     DECIMAL(10,2),
  diferencia_pct DECIMAL(5,2),
  medio_1       DECIMAL(10,2) DEFAULT 0,
  medio_2       DECIMAL(10,2) DEFAULT 0,
  cuarto_1      DECIMAL(10,2) DEFAULT 0,
  cuarto_2      DECIMAL(10,2) DEFAULT 0,
  cuarto_3      DECIMAL(10,2) DEFAULT 0,
  cuarto_4      DECIMAL(10,2) DEFAULT 0,
  fecha         DATE,
  observaciones TEXT,
  FOREIGN KEY (lote_id) REFERENCES lotes(id)
);

CREATE TABLE IF NOT EXISTS clientes (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  nombre   VARCHAR(100) NOT NULL,
  rfc      VARCHAR(20),
  contacto VARCHAR(100),
  telefono VARCHAR(20),
  activo   TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS entradas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  lote_id     INT,
  lote_num    VARCHAR(50),
  fecha       DATE        NOT NULL,
  tipo_ganado VARCHAR(50),
  codigo      VARCHAR(20),
  caja        INT,
  etiqueta_id INT,
  producto    VARCHAR(100),
  cajas       INT         DEFAULT 0,
  kilos       DECIMAL(10,2) DEFAULT 0,
  INDEX idx_entradas_etiqueta_id (etiqueta_id)
);

CREATE TABLE IF NOT EXISTS salidas (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  folio          INT,
  fecha          DATE         NOT NULL,
  cliente_id     INT,
  cliente_nombre VARCHAR(100),
  lote_canal     VARCHAR(50),
  codigo         VARCHAR(20),
  producto       VARCHAR(100),
  tipo_ganado    VARCHAR(50),
  cajas          INT          DEFAULT 0,
  kilos          DECIMAL(10,2) DEFAULT 0,
  barcode        VARCHAR(80),
  entregado_por  VARCHAR(100),
  observaciones  TEXT
);

-- Movimientos de inventario: ajustes internos (mermas, decomisos, correcciones)
-- que entran o salen de existencias. Cada movimiento se solicita (embarque)
-- y debe ser autorizado por oficina/administración antes de contar en
-- existencias. No confundir con `salidas`, que son embarques a cliente.
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  fecha                    DATE         NOT NULL,
  tipo_movimiento          ENUM('entrada','salida') NOT NULL DEFAULT 'salida',
  lote_num                 VARCHAR(50),
  codigo                   VARCHAR(20),
  producto                 VARCHAR(100),
  tipo_ganado              VARCHAR(50),
  cajas                    INT          DEFAULT 0,
  kilos                    DECIMAL(10,2) DEFAULT 0,
  motivo                   VARCHAR(50)  DEFAULT 'otro',
  observaciones            TEXT,
  estado                   ENUM('pendiente','autorizado','rechazado') NOT NULL DEFAULT 'pendiente',
  solicitado_por           INT,
  autorizado_por           INT,
  fecha_autorizacion       DATETIME,
  comentario_autorizacion  TEXT,
  FOREIGN KEY (solicitado_por) REFERENCES usuarios(id),
  FOREIGN KEY (autorizado_por) REFERENCES usuarios(id)
);

-- ── Fase 1: trazabilidad de etiquetas y consecutivos automáticos ──

CREATE TABLE IF NOT EXISTS contador_lotes (
  id     INT PRIMARY KEY DEFAULT 1,
  actual INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contador_cajas (
  lote_id INT         NOT NULL,
  codigo  VARCHAR(20) NOT NULL,
  actual  INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (lote_id, codigo),
  FOREIGN KEY (lote_id) REFERENCES lotes(id)
);

-- Código de barras canónico: CODIGO-LOTE-CAJA-KILOS (ej. 600-26-1-15.70)
-- El consecutivo de caja es por producto dentro del lote (lote_id, codigo).
CREATE TABLE IF NOT EXISTS etiquetas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  lote_id       INT,
  lote_num      VARCHAR(50)   NOT NULL,
  codigo        VARCHAR(20)   NOT NULL,
  producto      VARCHAR(100),
  caja          INT           NOT NULL,
  kilos         DECIMAL(10,2) NOT NULL,
  barcode       VARCHAR(80)   NOT NULL,
  fecha         DATE          NOT NULL,
  romaneaje     VARCHAR(100),
  activa        TINYINT(1)    DEFAULT 1,
  veces_impresa INT           DEFAULT 1,
  usuario_id    INT,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lote_id) REFERENCES lotes(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  UNIQUE KEY uq_etiqueta_caja (lote_id, codigo, caja),
  UNIQUE KEY uq_etiqueta_barcode (barcode)
);

-- Bitácora de auditoría: toda edición/eliminación debe quedar registrada
-- con una justificación. Solo el administrador debe poder consultarla.
CREATE TABLE IF NOT EXISTS bitacora (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id     INT,
  usuario_nombre VARCHAR(100),
  accion         VARCHAR(20)  NOT NULL,   -- 'editar' | 'eliminar' | 'autorizar' | 'rechazar'
  tabla          VARCHAR(50)  NOT NULL,
  registro_id    INT,
  justificacion  TEXT         NOT NULL,
  datos_antes    JSON,
  datos_despues  JSON,
  fecha          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
