import { Resend } from 'resend';

let resend = null;

function obtenerResend() {
  if (resend) return resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY debe estar definida en el entorno para enviar correo');
  resend = new Resend(apiKey);
  return resend;
}

/**
 * Envía un correo vía Resend. No lanza si la config falta al importar el
 * módulo (solo al enviar), y deja que el llamador decida si el fallo de
 * envío debe bloquear la respuesta HTTP o solo loguearse (fire-and-forget).
 */
export async function enviarCorreo({ destinatario, asunto, texto, html, cc }) {
  const remitente = process.env.EMAIL_FROM || 'AgroNet <notificaciones@mail.vetnetsolutions.com>';
  const { error } = await obtenerResend().emails.send({
    from: remitente,
    to: destinatario,
    ...(cc ? { cc } : {}),
    subject: asunto,
    text: texto,
    html: html || texto
  });
  if (error) throw new Error(`Resend rechazó el envío: ${error.message || JSON.stringify(error)}`);
}

/** Escapa & < > antes de interpolar valores dinámicos (nombres, contraseñas) en un template literal HTML. */
export function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
