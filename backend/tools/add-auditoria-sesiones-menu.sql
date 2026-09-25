-- Nueva pantalla "Auditoría de Sesiones" (historial de inicios/cierres de
-- sesión, con opción de cerrar sesiones activas). Se cuelga de
-- "Configuración" igual que Usuarios/Roles y Permisos, y se otorga acceso
-- ('ver') a superadmin y al administrador de capítulo ('adm').
INSERT INTO public.menus (nombre, ruta, icono, padre_id, orden, estado)
VALUES ('Auditoría de Sesiones', '/auditoria-sesiones', '🕵️', 3, 12, true)
RETURNING id;

-- (usa el id devuelto arriba como :menu_id en las dos filas de abajo)
INSERT INTO public.rol_menu_permiso (rol_id, menu_id, permiso_id)
SELECT 1, m.id, p.id FROM public.menus m, public.permisos p
WHERE m.ruta = '/auditoria-sesiones' AND p.codigo = 'ver';

INSERT INTO public.rol_menu_permiso (rol_id, menu_id, permiso_id)
SELECT 10, m.id, p.id FROM public.menus m, public.permisos p
WHERE m.ruta = '/auditoria-sesiones' AND p.codigo = 'ver';
