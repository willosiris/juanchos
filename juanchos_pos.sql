-- ============================================================================
-- JUANCHO'S · SISTEMA DE PUNTO DE VENTA (POS) PARA RESTAURANTE / SALCHIPAPERÍA
-- Archivo: juanchos_pos.sql
-- Motor compatible: MySQL 8.0+ / MariaDB 10.6+ (y bloque Supabase PostgreSQL al final)
-- Codificación: UTF-8 (utf8mb4)
--
-- Reglas de negocio implementadas:
--   1. Usuario Administrador maestro por defecto: WILLOSIRIS (PIN 6 dígitos: 749696).
--   2. Tres roles definidos: 'admin' (Administrador), 'caja' (Encargado de Caja)
--      y 'cocina' (Cocina), cada uno con matriz de privilegios y guía descriptiva.
--   3. Métodos de pago estrictamente limitados a 'Efectivo' y 'Yape' (informativo).
--   4. Un único ambiente inicial ('Salón Principal') en blanco (0 mesas) y soporte
--      de traslado entre mesas + estado de mesa ocupada/desocupada tras el pago.
--   5. Módulo de Envíos a domicilio (Delivery) con dirección y estado de pago.
--   6. Tablero de Inicio / Cocina para órdenes en espera de entrega.
--   7. Soporte de imágenes recortadas 1:1 y descripción en platos, insumos y usuarios.
--   8. Configuración de impresión automática (Ticketera 80mm por defecto para tickets
--      y cocina, y Hoja A4 exclusivamente para reportes), Supabase y Licencia
--      protegida con doble contraseña (749696 + 74969686@).
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '-05:00';

CREATE DATABASE IF NOT EXISTS juanchos_pos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE juanchos_pos;

-- ----------------------------------------------------------------------------
-- 1. Configuración general, Impresión (Tickets / A4), Supabase y Licencia
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion (
  id                  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  nombre_local        VARCHAR(80)      NOT NULL DEFAULT 'Juancho''s',
  lema_local          VARCHAR(120)     NOT NULL DEFAULT 'Salchipapería & Punto de venta',
  ruc_local           VARCHAR(11)      NULL,
  logo_principal      LONGTEXT         NULL,
  favicon             LONGTEXT         NULL,
  tema_visual         ENUM('dark', 'light') NOT NULL DEFAULT 'dark',
  tasa_igv            DECIMAL(5,4)     NOT NULL DEFAULT 0.1800,
  moneda_simbolo       VARCHAR(6)       NOT NULL DEFAULT 'S/',
  carpeta_descarga    VARCHAR(140)     NOT NULL DEFAULT 'Descargas/Juanchos_POS',
  actualizado_en      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_config_unica CHECK (id = 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS configuracion_impresion (
  id                     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  auto_imp_cocina        TINYINT(1)       NOT NULL DEFAULT 0,
  auto_imp_cobro         TINYINT(1)       NOT NULL DEFAULT 1,
  auto_imp_precuenta     TINYINT(1)       NOT NULL DEFAULT 1,
  usar_ticket_cliente    TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '0 = Control Interno (defecto), 1 = Ticket Normal Cliente',
  plantilla_interno_json JSON             NULL COMMENT 'Configuración de encabezado, etiquetas y pie del Ticket de Control Interno',
  plantilla_cliente_json JSON             NULL COMMENT 'Configuración de encabezado, etiquetas y pie del Ticket para Cliente',
  plantilla_a4_json      JSON             NULL COMMENT 'Configuración de encabezado, pie y márgenes de la Hoja A4 para Reportes',
  direccion_tienda       VARCHAR(120)     NOT NULL DEFAULT 'Av. Principal 123',
  ciudad_tienda          VARCHAR(80)      NOT NULL DEFAULT 'Lima, Perú',
  telefono_tienda        VARCHAR(40)      NOT NULL DEFAULT '(01) 555-1234',
  margen_mm              TINYINT UNSIGNED NOT NULL DEFAULT 4,
  font_titulo_px         TINYINT UNSIGNED NOT NULL DEFAULT 16,
  font_cuerpo_px         TINYINT UNSIGNED NOT NULL DEFAULT 12,
  modo_color_a4          ENUM('color', 'bn') NOT NULL DEFAULT 'color',
  pie_pagina             VARCHAR(200)     NULL,
  promo_texto            VARCHAR(200)     NULL,
  mostrar_logo           TINYINT(1)       NOT NULL DEFAULT 1,
  mostrar_barcode        TINYINT(1)       NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  CONSTRAINT chk_config_imp_unica CHECK (id = 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS configuracion_supabase (
  id                  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  api_url             VARCHAR(255)     NOT NULL DEFAULT 'https://lbjxpbroaprflqbwjbkz.supabase.co/rest/v1/',
  publishable_key     VARCHAR(255)     NOT NULL DEFAULT 'sb_publishable_1X3z3mGMFy64hqCS1bwZVw_ZvcWFmzX',
  conectado           TINYINT(1)       NOT NULL DEFAULT 1,
  ultima_sync         DATETIME         NULL,
  PRIMARY KEY (id),
  CONSTRAINT chk_config_supa_unica CHECK (id = 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS licencia_sistema (
  id                  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  activa              TINYINT(1)       NOT NULL DEFAULT 1,
  fecha_vencimiento   DATE             NULL,
  max_ventas_diarias  INT UNSIGNED     NOT NULL DEFAULT 0,
  clave_maestra_hash  CHAR(64)         NOT NULL DEFAULT '',
  actualizado_en      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_lic_unica CHECK (id = 1)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. Roles, Usuarios (con foto 1:1 y sesión de 3h) y Permisos con Guía
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nombre              VARCHAR(60)      NOT NULL,
  rol                 ENUM('admin', 'caja', 'cocina') NOT NULL DEFAULT 'caja',
  pin_hash            CHAR(64)         NOT NULL COMMENT 'SHA-256 del PIN con sal',
  pin_longitud        TINYINT UNSIGNED NOT NULL DEFAULT 6,
  clave_secreta_hash  CHAR(64)         NULL COMMENT 'SHA-256 de la contraseña secreta para autorizar edición/eliminación de reportes, mesas y productos',
  foto_1a1_url        LONGTEXT         NULL COMMENT 'Imagen recortada en formato 1:1 (PNG transparente soportado)',
  es_maestro          TINYINT(1)       NOT NULL DEFAULT 0,
  activo              TINYINT(1)       NOT NULL DEFAULT 1,
  ultimo_acceso       DATETIME         NULL,
  sesion_expira_en    DATETIME         NULL COMMENT 'Expira tras 3 horas de inactividad',
  creado_en           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permisos (
  codigo              VARCHAR(50)      NOT NULL,
  titulo              VARCHAR(80)      NOT NULL,
  guia_explicativa    VARCHAR(220)     NOT NULL,
  PRIMARY KEY (codigo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuario_permisos (
  usuario_id          INT UNSIGNED     NOT NULL,
  permiso_codigo      VARCHAR(50)      NOT NULL,
  activo              TINYINT(1)       NOT NULL DEFAULT 1,
  PRIMARY KEY (usuario_id, permiso_codigo),
  CONSTRAINT fk_up_usr FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_up_prm FOREIGN KEY (permiso_codigo) REFERENCES permisos (codigo) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. Ambientes y Mesas (con soporte de traslado y estado pagada_ocupada)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ambientes (
  id                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nombre              VARCHAR(50)      NOT NULL,
  orden               SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  activo              TINYINT(1)       NOT NULL DEFAULT 1,
  creado_por          INT UNSIGNED     NULL,
  creado_en           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ambientes_nombre (nombre),
  CONSTRAINT fk_amb_creador FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mesas (
  id                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  ambiente_id         INT UNSIGNED     NOT NULL,
  numero              VARCHAR(10)      NOT NULL,
  nombre              VARCHAR(40)      NOT NULL,
  capacidad           TINYINT UNSIGNED NOT NULL DEFAULT 4,
  estado              ENUM('libre', 'ocupada', 'precuenta', 'reservada') NOT NULL DEFAULT 'libre',
  pagada_ocupada      TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '1 si ya pagó pero los clientes siguen en la mesa',
  cocina_entregado    TINYINT(1)       NOT NULL DEFAULT 0,
  nota_reserva        VARCHAR(80)      NULL,
  ocupada_desde       DATETIME         NULL,
  activo              TINYINT(1)       NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mesa_ambiente_numero (ambiente_id, numero),
  CONSTRAINT fk_mesas_ambiente FOREIGN KEY (ambiente_id) REFERENCES ambientes (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. Envíos a domicilio / Delivery y Órdenes de Cocina ("En espera")
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS envios_domicilio (
  id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  cliente_nombre      VARCHAR(80)      NOT NULL,
  telefono            VARCHAR(20)      NULL,
  direccion_entrega   VARCHAR(160)     NOT NULL,
  observacion         VARCHAR(120)     NULL,
  modalidad_pago      ENUM('contraentrega_efectivo', 'contraentrega_yape', 'pagado_yape') NOT NULL DEFAULT 'contraentrega_efectivo',
  referencia_yape     VARCHAR(30)      NULL,
  cocina_entregado    TINYINT(1)       NOT NULL DEFAULT 0,
  pagado_finalizado   TINYINT(1)       NOT NULL DEFAULT 0,
  usuario_id          INT UNSIGNED     NOT NULL,
  creado_en           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_env_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ordenes_cocina (
  id                  VARCHAR(40)      NOT NULL,
  tipo_origen         ENUM('mesa', 'envio') NOT NULL DEFAULT 'mesa',
  ref_id              BIGINT UNSIGNED  NOT NULL,
  titulo              VARCHAR(80)      NOT NULL,
  subtitulo           VARCHAR(120)     NULL,
  direccion           VARCHAR(160)     NULL,
  items_json          JSON             NOT NULL,
  entregado           TINYINT(1)       NOT NULL DEFAULT 0 COMMENT 'Solo se modifica desde En espera (Cocina)',
  pagado              TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '1 cuando se cobra en Caja; permanece en En espera hasta retirarse',
  archivada           TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '1 cuando se retira manualmente desde En espera',
  hora_texto          VARCHAR(20)      NULL,
  creado_en           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. Categorías, Modificadores, Insumos y Productos (con Foto 1:1 y Descripción)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nombre              VARCHAR(40)      NOT NULL,
  orden               SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  activo              TINYINT(1)       NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS modificadores (
  id                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nombre              VARCHAR(40)      NOT NULL,
  activo              TINYINT(1)       NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_modificadores_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS insumos (
  id                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nombre              VARCHAR(60)      NOT NULL,
  unidad              ENUM('g', 'kg', 'ml', 'l', 'und') NOT NULL DEFAULT 'und',
  stock_actual        DECIMAL(12,3)    NOT NULL DEFAULT 0.000,
  stock_minimo        DECIMAL(12,3)    NOT NULL DEFAULT 0.000,
  imagen_1a1_url      LONGTEXT         NULL COMMENT 'Foto 1:1 opcional del insumo o ingrediente',
  activo              TINYINT(1)       NOT NULL DEFAULT 1,
  actualizado_en      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_insumos_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS productos (
  id                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  categoria_id        INT UNSIGNED     NOT NULL,
  nombre              VARCHAR(80)      NOT NULL,
  descripcion         VARCHAR(160)     NULL COMMENT 'Qué contiene el plato (visible en letras pequeñas en el catálogo)',
  imagen_1a1_url      LONGTEXT         NULL COMMENT 'Imagen de referencia 1:1 opcional (si no se selecciona, queda NULL)',
  precio              DECIMAL(10,2)    NOT NULL,
  activo              TINYINT(1)       NOT NULL DEFAULT 1,
  creado_en           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_productos_nombre (nombre),
  CONSTRAINT fk_prod_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON DELETE RESTRICT,
  CONSTRAINT chk_prod_precio CHECK (precio > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recetas (
  producto_id         INT UNSIGNED     NOT NULL,
  insumo_id           INT UNSIGNED     NOT NULL,
  cantidad            DECIMAL(12,3)    NOT NULL,
  PRIMARY KEY (producto_id, insumo_id),
  CONSTRAINT fk_rec_producto FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_insumo   FOREIGN KEY (insumo_id)   REFERENCES insumos (id)   ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  insumo_id           INT UNSIGNED     NOT NULL,
  usuario_id          INT UNSIGNED     NULL,
  tipo                ENUM('alta', 'compra', 'reposicion', 'consumo', 'reverso', 'merma', 'vencimiento', 'ajuste') NOT NULL,
  cantidad            DECIMAL(12,3)    NOT NULL,
  motivo              VARCHAR(120)     NULL,
  creado_en           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_mov_insumo  FOREIGN KEY (insumo_id)  REFERENCES insumos (id)  ON DELETE CASCADE,
  CONSTRAINT fk_mov_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. Turnos de Caja y Ventas (Efectivo y Yape; Ticket Interno por defecto)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turnos_caja (
  id                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nombre              VARCHAR(30)      NOT NULL,
  estado              ENUM('abierto', 'cerrado') NOT NULL DEFAULT 'abierto',
  abierto_por         INT UNSIGNED     NOT NULL,
  cerrado_por         INT UNSIGNED     NULL,
  abierto_en          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrado_en          DATETIME         NULL,
  total_vendido       DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  efectivo_esperado   DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  efectivo_contado    DECIMAL(12,2)    NULL,
  diferencia_efectivo DECIMAL(12,2)    NULL,
  yape_informativo    DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  CONSTRAINT fk_turno_abierto_por FOREIGN KEY (abierto_por) REFERENCES usuarios (id),
  CONSTRAINT fk_turno_cerrado_por FOREIGN KEY (cerrado_por) REFERENCES usuarios (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ventas (
  id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  turno_id            INT UNSIGNED     NOT NULL,
  usuario_id          INT UNSIGNED     NOT NULL,
  origen_tipo         ENUM('Salon', 'Envio') NOT NULL DEFAULT 'Salon',
  ambiente_nombre     VARCHAR(50)      NOT NULL,
  mesa_o_direccion    VARCHAR(160)     NOT NULL,
  comprobante_tipo    ENUM('Ticket Interno', 'Boleta', 'Factura') NOT NULL DEFAULT 'Ticket Interno',
  cliente_doc_tipo    ENUM('PG', 'DNI', 'RUC') NOT NULL DEFAULT 'PG',
  cliente_doc_num     VARCHAR(11)      NULL,
  cliente_nombre      VARCHAR(120)     NOT NULL DEFAULT 'Público general',
  metodo_pago         ENUM('Efectivo', 'Yape') NOT NULL,
  referencia_pago     VARCHAR(40)      NULL COMMENT 'N.º operación Yape informativo o Efectivo',
  subtotal_gravado    DECIMAL(12,2)    NOT NULL,
  igv                 DECIMAL(12,2)    NOT NULL,
  total               DECIMAL(12,2)    NOT NULL,
  monto_recibido      DECIMAL(12,2)    NOT NULL,
  vuelto              DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  impreso_ticket      TINYINT(1)       NOT NULL DEFAULT 1,
  creado_en           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ventas_fecha (creado_en),
  KEY idx_ventas_metodo (metodo_pago),
  CONSTRAINT fk_venta_turno   FOREIGN KEY (turno_id)   REFERENCES turnos_caja (id),
  CONSTRAINT fk_venta_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT chk_venta_metodo CHECK (metodo_pago IN ('Efectivo', 'Yape'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS venta_items (
  id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  venta_id            BIGINT UNSIGNED  NOT NULL,
  producto_id         INT UNSIGNED     NULL,
  producto_nombre     VARCHAR(80)      NOT NULL,
  cantidad            INT UNSIGNED     NOT NULL DEFAULT 1,
  precio_unitario     DECIMAL(10,2)    NOT NULL,
  subtotal            DECIMAL(12,2)    NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_vi_venta    FOREIGN KEY (venta_id)    REFERENCES ventas (id)    ON DELETE CASCADE,
  CONSTRAINT fk_vi_producto FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- SEMILLA INICIAL:
--   - Usuario Administrador maestro: WILLOSIRIS (PIN 6 dígitos: 749696)
--   - Catálogo de permisos con su guía explicativa
--   - Un único ambiente por defecto: 'Salón Principal' (0 mesas)
-- ============================================================================
INSERT INTO configuracion (id, nombre_local, lema_local, logo_principal, favicon)
VALUES (1, 'Juancho''s', 'Salchipapería & Punto de venta', 'logo.png', 'favicon.png')
ON DUPLICATE KEY UPDATE nombre_local = VALUES(nombre_local);

INSERT INTO configuracion_impresion (id) VALUES (1)
ON DUPLICATE KEY UPDATE id = VALUES(id);

INSERT INTO configuracion_supabase (id) VALUES (1)
ON DUPLICATE KEY UPDATE id = VALUES(id);

INSERT INTO licencia_sistema (id, activa, max_ventas_diarias, clave_maestra_hash)
VALUES (1, 1, 0, SHA2('74969686@', 256))
ON DUPLICATE KEY UPDATE activa = VALUES(activa);

INSERT INTO permisos (codigo, titulo, guia_explicativa) VALUES
  ('pedidos.inicio',      'Tablero de Inicio / Cocina',           'Permite ver los pedidos enviados a cocina en tiempo real y marcarlos como entregados o en espera.'),
  ('salon.operar',        'Atención de Salón y Mesas',            'Permite abrir mesas, trasladar cuentas de una mesa a otra y gestionar si la mesa queda ocupada o libre.'),
  ('mesas.modificar',     'Modificar Mesas y Capacidad',          'Permite editar la capacidad de personas y nombre de mesas en el salón.'),
  ('envios.operar',       'Gestión de Envíos (Delivery)',         'Permite registrar pedidos a domicilio con dirección y controlar su entrega y pago.'),
  ('comandera.operar',    'Toma de Pedidos en Comandera',         'Permite agregar platos, modificadores y enviar comandas a preparación.'),
  ('caja.cobrar',         'Caja y Cobranza (Efectivo / Yape)',    'Permite emitir comprobantes, dividir cuentas y registrar pagos en Efectivo o Yape.'),
  ('turno.cerrar',        'Reportes y Arqueo de Turno',           'Permite consultar ventas diarias/semanales/mensuales/anuales, imprimir reportes y cerrar turno.'),
  ('reportes.editar',     'Editar y Eliminar Reportes de Venta',  'Permite editar o eliminar registros del historial de ventas con su contraseña secreta.'),
  ('impresion.permitir',  'Autorización de Impresión',            'Si está activo, este usuario puede disparar impresiones de comandas y comprobantes.'),
  ('productos.editar',    'Editar Productos (Imagen y Precios)',  'Permite editar imagen 1:1, descripción y precios de productos del catálogo.'),
  ('carta.administrar',   'Administrar Carta y Stock',            'Permite crear, editar o eliminar platos, recetas, insumos y registrar mermas.'),
  ('ajustes.administrar', 'Ajustes Administrativos',              'Acceso total a usuarios, impresoras, conexión Supabase y licencia del sistema.')
ON DUPLICATE KEY UPDATE titulo = VALUES(titulo), guia_explicativa = VALUES(guia_explicativa);

INSERT INTO usuarios (id, nombre, rol, pin_hash, pin_longitud, clave_secreta_hash, es_maestro, activo)
VALUES (1, 'WILLOSIRIS', 'admin', SHA2('1:749696', 256), 6, SHA2('sec_1:749696', 256), 1, 1)
ON DUPLICATE KEY UPDATE nombre = 'WILLOSIRIS', rol = 'admin', pin_longitud = 6, es_maestro = 1;

INSERT IGNORE INTO usuario_permisos (usuario_id, permiso_codigo, activo)
SELECT 1, codigo, 1 FROM permisos;

INSERT INTO ambientes (id, nombre, orden, creado_por)
VALUES (1, 'Salón Principal', 1, 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ============================================================================
-- BLOQUE SUPABASE POSTGRESQL (Copiar el contenido interior en SQL Editor)
-- ============================================================================
/*
-- SCRIPT SQL PARA SUPABASE (JUANCHO'S POS - POSTGRESQL + RLS REST v1)
CREATE TABLE IF NOT EXISTS public.almacen (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  descripcion TEXT NOT NULL,
  compatibilidad TEXT DEFAULT 'GENERAL',
  stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  und TEXT DEFAULT 'Unidad',
  p_compra NUMERIC(10,2) DEFAULT 0,
  p_venta NUMERIC(10,2) DEFAULT 0,
  detalles TEXT DEFAULT '',
  imagen_url TEXT DEFAULT '',
  observacion TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clientes (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  origen TEXT NOT NULL DEFAULT 'SALON',
  nombre TEXT NOT NULL,
  documento TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usuarios_pos (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL DEFAULT 'caja',
  pin_hash TEXT NOT NULL,
  clave_secreta_hash TEXT DEFAULT '',
  foto_url TEXT DEFAULT '',
  permisos JSONB DEFAULT '[]'::jsonb,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ventas_pos (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  origen TEXT NOT NULL,
  comprobante TEXT NOT NULL DEFAULT 'Ticket Interno',
  cliente TEXT NOT NULL DEFAULT 'Público general',
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('Efectivo', 'Yape')),
  referencia TEXT DEFAULT '',
  total NUMERIC(10,2) NOT NULL,
  usuario TEXT NOT NULL,
  detalle JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.respaldos_json (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  nombre_local TEXT NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permisos REST v1 y Políticas RLS para acceso desde la aplicación web POS
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

ALTER TABLE public.almacen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respaldos_json ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_almacen_all" ON public.almacen;
CREATE POLICY "pos_almacen_all" ON public.almacen FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_clientes_all" ON public.clientes;
CREATE POLICY "pos_clientes_all" ON public.clientes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_usuarios_pos_all" ON public.usuarios_pos;
CREATE POLICY "pos_usuarios_pos_all" ON public.usuarios_pos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_ventas_pos_all" ON public.ventas_pos;
CREATE POLICY "pos_ventas_pos_all" ON public.ventas_pos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_respaldos_json_all" ON public.respaldos_json;
CREATE POLICY "pos_respaldos_json_all" ON public.respaldos_json FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
*/
