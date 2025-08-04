const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Caminho do banco de dados
const dbPath = path.join(__dirname, '../data/agendamento.db');

// Criar conexão com o banco
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar com o banco de dados:', err);
  } else {
    console.log('Conectado ao banco SQLite');
  }
});

// Função para inicializar o banco de dados
const initializeDatabase = async () => {
  return new Promise(async (resolve, reject) => {
    try {
      // Hash da senha padrão
      const defaultPasswordHash = await bcrypt.hash('Brisanet123', 10);
      
    db.serialize(() => {
      // Tabela de usuários (com campo para controle de primeira senha)
      db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL,
          cd TEXT,
          primeira_senha BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT NULL
        )
      `);

      // Tabela de agendamentos (com novos campos)
      db.run(`
        CREATE TABLE IF NOT EXISTS agendamentos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          empresa TEXT NOT NULL,
          email TEXT NOT NULL,
          telefone TEXT NOT NULL,
          nota_fiscal TEXT NOT NULL,
          numero_pedido TEXT NOT NULL,
          centro_distribuicao TEXT NOT NULL,
          data_entrega DATE NOT NULL,
          horario_entrega TEXT NOT NULL,
          volumes_paletes TEXT,
          valor_nota_fiscal DECIMAL(10,2),
          arquivo_nota_fiscal TEXT,
          status TEXT DEFAULT 'pendente_confirmacao',
          data_solicitacao DATETIME DEFAULT CURRENT_TIMESTAMP,
          confirmado_por TEXT,
          observacoes TEXT
        )
      `);

        // Verificar se já existem usuários
        db.get('SELECT COUNT(*) as count FROM usuarios', [], async (err, row) => {
          if (err) {
            console.error('Erro ao verificar usuários:', err);
            reject(err);
            return;
          }

          // Se não há usuários, inserir os padrões
          if (row.count === 0) {
      const usuarios = [
              { username: 'Bahia', password: defaultPasswordHash, role: 'institution', cd: 'Bahia' },
              { username: 'Pernambuco', password: defaultPasswordHash, role: 'institution', cd: 'Pernambuco' },
              { username: 'LagoaNova', password: defaultPasswordHash, role: 'institution', cd: 'Lagoa Nova' },
              { username: 'admin', password: defaultPasswordHash, role: 'admin', cd: 'all' },
        // ✅ NOVOS USUÁRIOS CONSULTIVOS
              { username: 'PCM', password: defaultPasswordHash, role: 'consultivo', cd: 'all' },
              { username: 'Compras', password: defaultPasswordHash, role: 'consultivo', cd: 'all' },
              { username: 'Transportes', password: defaultPasswordHash, role: 'consultivo', cd: 'all' }
      ];

      // Inserir usuários
      const insertUser = db.prepare(`
        INSERT INTO usuarios (username, password, role, cd, primeira_senha)
        VALUES (?, ?, ?, ?, 1)
      `);

      usuarios.forEach(user => {
        insertUser.run(user.username, user.password, user.role, user.cd);
      });

      insertUser.finalize();
            console.log('✅ Usuários padrão criados com senhas hasheadas');
          } else {
            console.log('✅ Usuários já existem no banco');
          }

          console.log('✅ Tabelas criadas e verificadas com sucesso');
      resolve();
    });
      });
    } catch (error) {
      console.error('Erro ao inicializar banco:', error);
      reject(error);
    }
  });
};

// Função para limpeza mensal dos dados
const cleanupOldData = () => {
  return new Promise((resolve, reject) => {
    // Deletar agendamentos mais antigos que 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    db.run(`
      DELETE FROM agendamentos 
      WHERE data_solicitacao < ?
    `, [thirtyDaysAgo.toISOString()], function(err) {
      if (err) {
        console.error('Erro na limpeza dos dados:', err);
        reject(err);
      } else {
        console.log(`🧹 Limpeza concluída. ${this.changes} registros removidos.`);
        resolve(this.changes);
      }
    });
  });
};

// Funções utilitárias
const getQuery = (sql, params = [], all = false) => {
  return new Promise((resolve, reject) => {
    const method = all ? 'all' : 'get';
    db[method](sql, params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

module.exports = {
  db,
  initializeDatabase,
  cleanupOldData,
  getQuery,
  runQuery,
  allQuery
}; 