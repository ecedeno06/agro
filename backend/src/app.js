import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import fincasRoutes from './routes/fincas.routes.js';
import cuotasRoutes from './routes/cuotas.routes.js';
import juntaRoutes from './routes/junta.routes.js';
import navigationRoutes from './routes/navigation.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import tipoSuelosRoutes from './routes/tipo-suelos.routes.js';
import tipoTerrenoRoutes from './routes/tipo-terreno.routes.js';
import tipoGeografiaRoutes from './routes/tipo-geografia.routes.js';
import tipoEstadoLegalRoutes from './routes/tipo-estado-legal.routes.js';
import paisesRoutes from './routes/paises.routes.js';
import fenomenosRoutes from './routes/fenomenos.routes.js';
import fincaFenomenosRoutes from './routes/finca-fenomenos.routes.js';
import errorMiddleware from './middlewares/error.middleware.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/fincas', fincasRoutes);
app.use('/api/cuotas', cuotasRoutes);
app.use('/api/junta-directiva', juntaRoutes);
app.use('/api/navigation', navigationRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/tipo-suelos', tipoSuelosRoutes);
app.use('/api/tipo-terreno', tipoTerrenoRoutes);
app.use('/api/tipo-geografia', tipoGeografiaRoutes);
app.use('/api/tipo-estado-legal', tipoEstadoLegalRoutes);
app.use('/api/paises', paisesRoutes);
app.use('/api/fenomenos', fenomenosRoutes);
app.use('/api/fincas-fenomenos', fincaFenomenosRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Agro1.0 API de Autenticación Funcionando...' });
});

// Error handling
app.use(errorMiddleware);

export default app;
