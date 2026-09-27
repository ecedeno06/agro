-- =========================================================
-- Catálogo GLOBAL de Productos + Inventario por Finca
-- PostgreSQL — ADAPTADO al esquema real de agro 1.1
--
-- Cambios respecto al script original pegado por el usuario:
--   1) Se ELIMINA por completo el CREATE TABLE fincas: la tabla
--      public.fincas YA EXISTE en esta base (PK real: id_finca,
--      tipo bigint; columnas nombre_finca, id_propietario, etc.).
--      Crear una tabla "fincas" nueva habría chocado con la real
--      (o, peor, la habría reemplazado si alguien agregaba
--      IF NOT EXISTS/DROP a ciegas).
--   2) finca_productos.finca_id ahora referencia
--      public.fincas(id_finca) con tipo BIGINT (coincide con el
--      real), en vez de una tabla/columna que no existe.
--   3) Se elimina el trigger trg_fincas_actualizado: la tabla
--      fincas real NO tiene columna actualizado_en, así que ese
--      trigger habría roto cualquier UPDATE a fincas.
--   4) Se elimina el INSERT INTO fincas (...) de ejemplo (no se
--      deben insertar fincas falsas en la tabla real). El seed de
--      finca_productos usa nombres de fincas reales ya existentes
--      vía subquery, no IDs inventados.
--   5) Se agrega el prefijo public. de forma consistente.
--
-- Idea clave (sin cambios): el catálogo (qué productos existen) es
-- único y compartido por todas las fincas. Cada finca decide qué
-- productos de ese catálogo ofrece, a qué precio y con qué stock
-- (tabla finca_productos).
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- Tabla: categorias (jerárquica: Productos -> Carnes, Granos, etc.)
-- ---------------------------------------------------------
CREATE TABLE public.categorias (
    id                  SERIAL PRIMARY KEY,
    nombre              VARCHAR(100) NOT NULL,
    icono               VARCHAR(20),
    categoria_padre_id  INTEGER REFERENCES public.categorias(id) ON DELETE CASCADE,
    orden               INTEGER DEFAULT 0,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- Tabla: unidades_medida
-- ---------------------------------------------------------
CREATE TABLE public.unidades_medida (
    id      SERIAL PRIMARY KEY,
    nombre  VARCHAR(50) NOT NULL UNIQUE,
    abrev   VARCHAR(10) NOT NULL
);

-- ---------------------------------------------------------
-- Tabla: catalogo_productos (CATÁLOGO GLOBAL, sin finca)
-- Define el "maestro" de productos que cualquier finca puede
-- ofrecer: nombre, categoría, unidad, descripción, imagen.
-- No tiene precio ni stock (eso es por finca).
-- ---------------------------------------------------------
CREATE TABLE public.catalogo_productos (
    id                  SERIAL PRIMARY KEY,
    categoria_id        INTEGER NOT NULL REFERENCES public.categorias(id) ON DELETE RESTRICT,
    unidad_medida_id    INTEGER REFERENCES public.unidades_medida(id),
    nombre              VARCHAR(150) NOT NULL,
    descripcion         TEXT,
    codigo              VARCHAR(50) UNIQUE,      -- código global del producto (ej. CAR-001)
    imagen_url          VARCHAR(500),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- Tabla: finca_productos (relación N:M entre la tabla REAL
-- public.fincas y el catálogo global). Aquí viven precio y
-- stock, propios de cada finca para ese producto del catálogo.
-- ---------------------------------------------------------
CREATE TABLE public.finca_productos (
    id                  SERIAL PRIMARY KEY,
    finca_id            BIGINT NOT NULL REFERENCES public.fincas(id_finca) ON DELETE CASCADE,
    producto_id         INTEGER NOT NULL REFERENCES public.catalogo_productos(id) ON DELETE CASCADE,
    precio              NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
    stock               NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (stock >= 0),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (finca_id, producto_id)   -- una finca no repite el mismo producto del catálogo
);

-- ---------------------------------------------------------
-- Índices
-- ---------------------------------------------------------
CREATE INDEX idx_catalogo_categoria     ON public.catalogo_productos(categoria_id);
CREATE INDEX idx_catalogo_activo        ON public.catalogo_productos(activo);
CREATE INDEX idx_categorias_padre       ON public.categorias(categoria_padre_id);
CREATE INDEX idx_finca_productos_finca  ON public.finca_productos(finca_id);
CREATE INDEX idx_finca_productos_prod   ON public.finca_productos(producto_id);

-- ---------------------------------------------------------
-- Trigger genérico para actualizado_en (solo en las tablas NUEVAS
-- que sí tienen esa columna; NO se toca public.fincas)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_catalogo_actualizado
BEFORE UPDATE ON public.catalogo_productos
FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

CREATE TRIGGER trg_finca_productos_actualizado
BEFORE UPDATE ON public.finca_productos
FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

-- =========================================================
-- Datos de ejemplo (seed) — catálogo global, no toca fincas
-- =========================================================

INSERT INTO public.categorias (nombre, icono, categoria_padre_id) VALUES
    ('Productos', '🛒', NULL);

INSERT INTO public.categorias (nombre, icono, categoria_padre_id) VALUES
    ('Carnes',            '🥩', (SELECT id FROM public.categorias WHERE nombre = 'Productos')),
    ('Granos',            '🌾', (SELECT id FROM public.categorias WHERE nombre = 'Productos')),
    ('Lácteos',           '🥛', (SELECT id FROM public.categorias WHERE nombre = 'Productos')),
    ('Aves y Huevos',     '🥚', (SELECT id FROM public.categorias WHERE nombre = 'Productos')),
    ('Frutas',            '🍎', (SELECT id FROM public.categorias WHERE nombre = 'Productos')),
    ('Verduras',          '🥦', (SELECT id FROM public.categorias WHERE nombre = 'Productos')),
    ('Tubérculos y Raíces','🥔', (SELECT id FROM public.categorias WHERE nombre = 'Productos')),
    ('Legumbres',         '🫘', (SELECT id FROM public.categorias WHERE nombre = 'Productos')),
    ('Productos del Mar', '🐟', (SELECT id FROM public.categorias WHERE nombre = 'Productos')),
    ('Semillas',          '🌱', (SELECT id FROM public.categorias WHERE nombre = 'Productos')),
    ('Insumos Agrícolas', '🧪', (SELECT id FROM public.categorias WHERE nombre = 'Productos')),
    ('Forraje y Alimento Animal', '🐄', (SELECT id FROM public.categorias WHERE nombre = 'Productos'));

INSERT INTO public.unidades_medida (nombre, abrev) VALUES
    ('Kilogramo', 'kg'),
    ('Libra', 'lb'),
    ('Unidad', 'und'),
    ('Saco 50kg', 'saco'),
    ('Litro', 'l'),
    ('Docena', 'doc'),
    ('Quintal', 'qq'),
    ('Tonelada', 'ton'),
    ('Fardo', 'fardo'),
    ('Galón', 'gal');

-- CARNES
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Carne de Res - Lomo', 'Corte fresco de lomo de res', 'CAR-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Carne de Res - Falda', 'Corte de falda para asado', 'CAR-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Carne de Res - Molida', 'Carne molida fresca', 'CAR-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Carne de Res - Costilla', 'Costilla de res', 'CAR-004'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Carne de Cerdo - Chuleta', 'Chuleta fresca de cerdo', 'CAR-005'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Carne de Cerdo - Costilla', 'Costilla de cerdo', 'CAR-006'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Carne de Cerdo - Molida', 'Carne de cerdo molida', 'CAR-007'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 3, 'Pollo Entero', 'Pollo entero fresco', 'CAR-008'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Pechuga de Pollo', 'Pechuga de pollo sin hueso', 'CAR-009'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Muslo de Pollo', 'Muslo de pollo con hueso', 'CAR-010'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Carne de Cordero', 'Carne de cordero fresca', 'CAR-011'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Chorizo Artesanal', 'Chorizo de cerdo condimentado', 'CAR-012'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Carnes'), 1, 'Tocino / Bacon', 'Tocino ahumado', 'CAR-013');

-- GRANOS
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Granos'), 4, 'Maíz Amarillo', 'Maíz para consumo animal', 'GRA-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Granos'), 4, 'Maíz Blanco', 'Maíz para consumo humano', 'GRA-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Granos'), 4, 'Arroz', 'Arroz de grano largo', 'GRA-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Granos'), 4, 'Sorgo', 'Grano de sorgo', 'GRA-004'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Granos'), 4, 'Trigo', 'Trigo grano entero', 'GRA-005'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Granos'), 4, 'Avena', 'Avena en grano', 'GRA-006'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Granos'), 4, 'Soya', 'Grano de soya', 'GRA-007');

-- LÁCTEOS
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Lácteos'), 5, 'Leche de Vaca Fresca', 'Leche cruda fresca', 'LAC-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Lácteos'), 3, 'Queso Fresco', 'Queso fresco artesanal', 'LAC-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Lácteos'), 1, 'Queso Semiduro', 'Queso semiduro madurado', 'LAC-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Lácteos'), 1, 'Mantequilla', 'Mantequilla artesanal', 'LAC-004'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Lácteos'), 5, 'Yogurt Natural', 'Yogurt natural sin azúcar', 'LAC-005'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Lácteos'), 1, 'Cuajada', 'Cuajada fresca', 'LAC-006');

-- AVES Y HUEVOS
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Aves y Huevos'), 6, 'Huevos de Gallina', 'Huevos frescos de gallina', 'AVE-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Aves y Huevos'), 6, 'Huevos de Codorniz', 'Huevos frescos de codorniz', 'AVE-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Aves y Huevos'), 3, 'Pato Entero', 'Pato entero fresco', 'AVE-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Aves y Huevos'), 3, 'Pavo Entero', 'Pavo entero fresco', 'AVE-004');

-- FRUTAS
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Frutas'), 1, 'Plátano', 'Plátano verde/maduro', 'FRU-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Frutas'), 1, 'Guineo (Banano)', 'Banano fresco', 'FRU-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Frutas'), 1, 'Piña', 'Piña fresca', 'FRU-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Frutas'), 1, 'Sandía', 'Sandía fresca', 'FRU-004'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Frutas'), 1, 'Melón', 'Melón fresco', 'FRU-005'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Frutas'), 1, 'Naranja', 'Naranja fresca', 'FRU-006'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Frutas'), 1, 'Limón', 'Limón fresco', 'FRU-007'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Frutas'), 1, 'Mango', 'Mango fresco', 'FRU-008'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Frutas'), 1, 'Aguacate', 'Aguacate fresco', 'FRU-009'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Frutas'), 1, 'Papaya', 'Papaya fresca', 'FRU-010');

-- VERDURAS
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Verduras'), 1, 'Tomate', 'Tomate fresco', 'VER-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Verduras'), 1, 'Cebolla', 'Cebolla fresca', 'VER-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Verduras'), 1, 'Pimentón', 'Pimentón fresco', 'VER-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Verduras'), 1, 'Lechuga', 'Lechuga fresca', 'VER-004'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Verduras'), 1, 'Repollo', 'Repollo fresco', 'VER-005'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Verduras'), 1, 'Zanahoria', 'Zanahoria fresca', 'VER-006'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Verduras'), 1, 'Pepino', 'Pepino fresco', 'VER-007'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Verduras'), 1, 'Chayote', 'Chayote fresco', 'VER-008'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Verduras'), 1, 'Culantro', 'Culantro fresco', 'VER-009');

-- TUBÉRCULOS Y RAÍCES
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Tubérculos y Raíces'), 1, 'Papa', 'Papa fresca', 'TUB-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Tubérculos y Raíces'), 1, 'Yuca', 'Yuca fresca', 'TUB-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Tubérculos y Raíces'), 1, 'Ñame', 'Ñame fresco', 'TUB-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Tubérculos y Raíces'), 1, 'Otoe', 'Otoe fresco', 'TUB-004'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Tubérculos y Raíces'), 1, 'Camote', 'Camote fresco', 'TUB-005'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Tubérculos y Raíces'), 1, 'Zanahoria Blanca', 'Zanahoria blanca / arracacha', 'TUB-006');

-- LEGUMBRES
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Legumbres'), 1, 'Frijol Rojo', 'Frijol rojo seco', 'LEG-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Legumbres'), 1, 'Frijol Negro', 'Frijol negro seco', 'LEG-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Legumbres'), 1, 'Lenteja', 'Lenteja seca', 'LEG-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Legumbres'), 1, 'Garbanzo', 'Garbanzo seco', 'LEG-004'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Legumbres'), 1, 'Guandú', 'Guandú fresco/seco', 'LEG-005');

-- PRODUCTOS DEL MAR
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Productos del Mar'), 1, 'Tilapia', 'Tilapia fresca de piscicultura', 'MAR-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Productos del Mar'), 1, 'Camarón', 'Camarón fresco', 'MAR-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Productos del Mar'), 1, 'Corvina', 'Corvina fresca', 'MAR-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Productos del Mar'), 1, 'Pargo', 'Pargo fresco', 'MAR-004');

-- SEMILLAS
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Semillas'), 1, 'Semilla de Maíz', 'Semilla certificada de maíz', 'SEM-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Semillas'), 1, 'Semilla de Arroz', 'Semilla certificada de arroz', 'SEM-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Semillas'), 1, 'Semilla de Frijol', 'Semilla de frijol para siembra', 'SEM-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Semillas'), 1, 'Semilla de Tomate', 'Semilla de tomate para siembra', 'SEM-004');

-- INSUMOS AGRÍCOLAS
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Insumos Agrícolas'), 4, 'Fertilizante 10-20-20', 'Fertilizante granulado', 'INS-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Insumos Agrícolas'), 4, 'Fertilizante Orgánico', 'Abono orgánico compostado', 'INS-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Insumos Agrícolas'), 10, 'Herbicida', 'Herbicida de uso general', 'INS-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Insumos Agrícolas'), 10, 'Insecticida', 'Insecticida de uso general', 'INS-004'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Insumos Agrícolas'), 10, 'Fungicida', 'Fungicida de uso general', 'INS-005');

-- FORRAJE Y ALIMENTO ANIMAL
INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo) VALUES
    ((SELECT id FROM public.categorias WHERE nombre = 'Forraje y Alimento Animal'), 9, 'Heno / Pasto de Corte', 'Fardo de heno para ganado', 'FOR-001'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Forraje y Alimento Animal'), 4, 'Concentrado para Ganado', 'Alimento balanceado bovino', 'FOR-002'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Forraje y Alimento Animal'), 4, 'Concentrado para Aves', 'Alimento balanceado avícola', 'FOR-003'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Forraje y Alimento Animal'), 4, 'Concentrado para Cerdos', 'Alimento balanceado porcino', 'FOR-004'),
    ((SELECT id FROM public.categorias WHERE nombre = 'Forraje y Alimento Animal'), 4, 'Sal Mineralizada', 'Suplemento mineral para ganado', 'FOR-005');

-- NOTA: no se inserta ningún seed en finca_productos (no se deben
-- inventar precios/stock para fincas reales). Una vez implementado
-- el CRUD, cada finca agrega sus propios productos del catálogo con
-- su precio/stock desde la interfaz.

COMMIT;
