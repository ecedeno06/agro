-- Esquema para la Base de Datos de Agro1.0 (usando la tabla 'usuarios' existente)

-- Crear la tabla 'usuarios' si no existe
CREATE TABLE IF NOT EXISTS usuarios (
    "idUsuario" BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    activo BOOLEAN DEFAULT true
);

-- Agregar columnas necesarias si no existen (sin alterar las existentes de mascotas)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(50) NOT NULL DEFAULT 'operario';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);

-- Insertar datos semilla (Contraseña: agro123, hash de bcrypt)
INSERT INTO usuarios (nombre, email, password, telefono, rol)
VALUES 
('Administrador Agro', 'admin@agro.com', '$2b$10$W47aA4y.bMeq1kZfeU7fP.lQ/M0J15hSEx9RkG8NlyuCqQxXWly5C', '123456789', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO usuarios (nombre, email, password, telefono, rol)
VALUES 
('Veterinario Campo', 'vet@agro.com', '$2b$10$W47aA4y.bMeq1kZfeU7fP.lQ/M0J15hSEx9RkG8NlyuCqQxXWly5C', '987654321', 'veterinario')
ON CONFLICT (email) DO NOTHING;

-- Crear la tabla de 'sesiones' si no existe (idéntica al esquema de Mascotas)
CREATE TABLE IF NOT EXISTS public.sesiones (
    id SERIAL PRIMARY KEY,
    token VARCHAR(100) NOT NULL UNIQUE,
    id_usuario INT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT now(),
    expira_en TIMESTAMPTZ NOT NULL,
    activo BOOLEAN DEFAULT true,
    razon_salida VARCHAR(100),
    duracion_segundos INT,
    CONSTRAINT fk_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuarios("idUsuario") ON DELETE CASCADE
);

-- Columna rol_codigo usada por el authMiddleware para conocer el rol activo de la sesión
ALTER TABLE public.sesiones ADD COLUMN IF NOT EXISTS rol_codigo VARCHAR(50);

-- Capítulo activo de la sesión: permite acotar los datos que ve un rol no global (ej. ADM de capítulo)
ALTER TABLE public.sesiones ADD COLUMN IF NOT EXISTS id_capitulo INT;

CREATE INDEX IF NOT EXISTS idx_sesiones_capitulo ON public.sesiones (id_capitulo);
CREATE INDEX IF NOT EXISTS idx_sesiones_token_activo ON public.sesiones (token) WHERE activo = true;
