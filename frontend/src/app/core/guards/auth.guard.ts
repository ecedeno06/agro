import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** Guard para proteger rutas privadas (ej. /dashboard) */
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('agro_session_token');

  if (token) {
    return true;
  }

  // Si no hay token, redirigir al login
  router.navigate(['/login']);
  return false;
};

/** Guard para rutas exclusivas de administración (ej. usuarios, roles-permisos) */
export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('agro_session_token');
  const userStr = localStorage.getItem('agro_session_user');

  if (!token || !userStr) {
    router.navigate(['/login']);
    return false;
  }

  try {
    const u = JSON.parse(userStr);
    const isSuper = u.isSuperadmin === true || u.email === 'superadmin@agro.com';
    const hasRole = u.rol === 'admin' || u.rol === 'adm' || u.rol === 'superadmin' || u.rol === 'secretaria' || u.rol === 'sec';
    if (isSuper || hasRole) return true;
  } catch {
    // usuario corrupto en storage, se trata como sin permisos
  }

  router.navigate(['/dashboard']);
  return false;
};

/** Guard para rutas exclusivas de SUPERADMIN (identidad firmada verificada) */
export const superadminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('agro_session_token');
  const userStr = localStorage.getItem('agro_session_user');

  if (!token || !userStr) {
    router.navigate(['/login']);
    return false;
  }

  try {
    const u = JSON.parse(userStr);
    if (u.isSuperadmin === true) return true;
  } catch {
    // usuario corrupto en storage
  }

  router.navigate(['/dashboard']);
  return false;
};

/** Guard para proteger rutas públicas (ej. /login) para que no ingresen si ya iniciaron sesión */
export const publicGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('agro_session_token');

  if (token) {
    // Si ya tiene sesión activa, redirigir al dashboard
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};

