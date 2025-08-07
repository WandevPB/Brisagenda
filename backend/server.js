const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const { initializeDatabase, cleanupOldData } = require('./config/database');
const authRoutes = require('./routes/auth');
const agendamentoRoutes = require('./routes/agendamentos');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares de segurança
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests por IP por 15 minutos
});
app.use('/api/', limiter);

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de debug para todas as requisições
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Servir arquivos estáticos do diretório uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas
app.use('/api/agendamentos', agendamentoRoutes); // Movendo para primeiro
app.use('/api/auth', authRoutes);
app.use('/api/entrega', require('./routes/entrega'));
app.use('/api/database', require('./routes/database'));
app.use('/api/upload', uploadRoutes);

// Middleware para capturar rotas não encontradas
app.use((req, res, next) => {
  console.log('Rota não encontrada:', req.method, req.originalUrl);
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Rota de saúde
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime() 
  });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Algo deu errado!', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
  });
});

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

// Inicializar banco de dados e servidor
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📊 Banco de dados inicializado com sucesso`);
    });
  })
  .catch(err => {
    console.error('❌ Erro ao inicializar banco de dados:', err);
    process.exit(1);
  });

// Cron job para limpeza mensal dos dados (todo dia 1 às 02:00)
cron.schedule('0 2 1 * *', () => {
  console.log('🧹 Executando limpeza mensal dos dados...');
  cleanupOldData();
}, {
  scheduled: true,
  timezone: "America/Sao_Paulo"
});

module.exports = app; 