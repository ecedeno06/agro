import { crearUsuario } from './src/controllers/user.controller.js';
import pool from './src/db.js';

// El payload JSON enviado por el cliente
const payload = {
  nombre: 'edwin cedeno',
  email: 'edwin.e.cedeno@gmail.com',
  password: 'agro123password', // Contraseña por defecto ya que no se especificó
  telefono: '64564920',
  rol: 'operario'
};

// Simulamos los objetos req y res de Express
const req = {
  body: payload
};

const res = {
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    console.log(`\n✅ Proceso completado. Código de respuesta HTTP: ${this.statusCode}`);
    console.log('Respuesta JSON enviada al cliente:');
    console.log(JSON.stringify(data, null, 2));
    pool.end();
  }
};

const next = (err) => {
  console.error('❌ Error capturado por el middleware de error:', err.message);
  pool.end();
};

console.log('Enviando el siguiente JSON al controlador de creación de usuarios:');
console.log(JSON.stringify(payload, null, 2));

// Ejecutamos la función del controlador directamente
crearUsuario(req, res, next);
