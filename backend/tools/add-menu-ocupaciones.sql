-- Agrega la opción de menú "Ocupaciones" bajo Configuración (padre_id=3),
-- con el mismo patrón de permisos que "Tipos de Suelos" (menu_id=13):
-- superadmin (1) y Tes (5): ver/crear/editar/eliminar
-- adm (10): ver/crear/editar (sin eliminar)
-- resto de roles (2,3,4,6,9): solo ver
INSERT INTO menus (nombre, ruta, icono, padre_id, orden, estado)
VALUES ('Ocupaciones', '/ocupaciones', '💼', 3, 13, true)
RETURNING id;
