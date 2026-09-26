/** Código de país por defecto cuando el teléfono no trae ninguno (mercado principal de la app). */
export const CODIGO_TELEFONO_DEFECTO = '507';

/**
 * Separa un teléfono guardado como texto combinado (ej. "+507 6123-4567") en
 * código de país y número local. Si no trae código reconocible, se asume
 * CODIGO_TELEFONO_DEFECTO y todo el texto pasa como número local (compatible
 * con teléfonos guardados antes de este selector).
 */
export function dividirTelefono(telefono: string | null | undefined): { codigo: string; numero: string } {
  const valor = (telefono || '').trim();
  const match = valor.match(/^\+(\d{1,4})\s+(.*)$/);
  if (match) {
    return { codigo: match[1], numero: match[2] };
  }
  return { codigo: CODIGO_TELEFONO_DEFECTO, numero: valor };
}

/** Combina código de país + número local en el texto único que se guarda en la columna telefono. */
export function combinarTelefono(codigo: string | null | undefined, numero: string | null | undefined): string {
  const num = (numero || '').trim();
  if (!num) return '';
  const cod = (codigo || CODIGO_TELEFONO_DEFECTO).trim();
  return `+${cod} ${num}`;
}
