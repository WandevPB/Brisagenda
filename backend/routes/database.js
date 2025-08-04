const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Middleware para verificar se é admin
router.use(authenticateToken);
router.use(isAdmin);

// Listar todas as tabelas
router.get('/tables', async (req, res) => {
  try {
    const tables = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({ success: true, data: tables });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter estrutura de uma tabela
router.get('/table/:tableName/schema', async (req, res) => {
  try {
    const { tableName } = req.params;
    
    const schema = await new Promise((resolve, reject) => {
      db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({ success: true, data: schema });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter dados de uma tabela (com paginação)
router.get('/table/:tableName/data', async (req, res) => {
  try {
    const { tableName } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    // Contar total de registros
    const totalCount = await new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) as count FROM ${tableName}`, [], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    // Obter dados paginados
    const data = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({ 
      success: true, 
      data: {
        records: data,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Executar query SQL personalizada (apenas SELECT)
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    // Validar que é apenas SELECT
    if (!query.trim().toLowerCase().startsWith('select')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Apenas queries SELECT são permitidas' 
      });
    }
    
    const result = await new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter estatísticas do banco
router.get('/stats', async (req, res) => {
  try {
    const stats = {};
    
    // Contar usuários
    const userCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM usuarios', [], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    // Contar agendamentos
    const agendamentoCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM agendamentos', [], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    // Agendamentos por status
    const statusStats = await new Promise((resolve, reject) => {
      db.all('SELECT status, COUNT(*) as count FROM agendamentos GROUP BY status', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Agendamentos por centro
    const centroStats = await new Promise((resolve, reject) => {
      db.all('SELECT centro_distribuicao, COUNT(*) as count FROM agendamentos GROUP BY centro_distribuicao', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Tamanho do banco
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.join(__dirname, '../database.sqlite');
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    
    stats.totalUsers = userCount;
    stats.totalAgendamentos = agendamentoCount;
    stats.statusDistribution = statusStats;
    stats.centroDistribution = centroStats;
    stats.databaseSize = dbSize;
    stats.databaseSizeFormatted = formatBytes(dbSize);
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backup do banco
router.post('/backup', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const dbPath = path.join(__dirname, '../database.sqlite');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, `../backups/backup_${timestamp}.sqlite`);
    
    // Criar diretório de backup se não existir
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Copiar arquivo
    fs.copyFileSync(dbPath, backupPath);
    
    res.json({ 
      success: true, 
      message: 'Backup criado com sucesso',
      filename: `backup_${timestamp}.sqlite`,
      size: formatBytes(fs.statSync(backupPath).size)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Limpar dados antigos
router.post('/cleanup', async (req, res) => {
  try {
    const { days = 30 } = req.body;
    
    const result = await new Promise((resolve, reject) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      db.run(
        'DELETE FROM agendamentos WHERE data_solicitacao < ?',
        [cutoffDate.toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    res.json({ 
      success: true, 
      message: `${result} registros removidos`,
      removedCount: result 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Função auxiliar para formatar bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = router; 