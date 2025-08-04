// 🔄 Script de Migração: SQLite → PostgreSQL
const sqlite3 = require('sqlite3');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Configurações
const sqliteDb = new sqlite3.Database('./backend/database.sqlite');

// PostgreSQL na nuvem (substitua pela sua URL)
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:pass@supabase.co:5432/database',
  ssl: { rejectUnauthorized: false }
});

async function migrarDados() {
  console.log('🚀 Iniciando migração...');

  try {
    // 1. Criar tabelas no PostgreSQL
    console.log('📋 Criando tabelas...');
    
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'instituicao',
        centro_distribuicao VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        empresa VARCHAR(255) NOT NULL,
        nota_fiscal VARCHAR(255) NOT NULL,
        numero_pedido VARCHAR(255) NOT NULL,
        centro_distribuicao VARCHAR(255) NOT NULL,
        data_entrega DATE NOT NULL,
        horario_entrega INTEGER NOT NULL,
        email VARCHAR(255),
        telefone VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pendente_confirmacao',
        data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmado_por VARCHAR(255),
        observacoes TEXT
      )
    `);

    // 2. Migrar usuários
    console.log('👥 Migrando usuários...');
    const usuarios = await new Promise((resolve, reject) => {
      sqliteDb.all("SELECT * FROM usuarios", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    for (const usuario of usuarios) {
      await pgPool.query(
        'INSERT INTO usuarios (username, password, role, centro_distribuicao) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
        [usuario.username, usuario.password, usuario.role, usuario.centro_distribuicao]
      );
    }

    // 3. Migrar agendamentos
    console.log('📅 Migrando agendamentos...');
    const agendamentos = await new Promise((resolve, reject) => {
      sqliteDb.all("SELECT * FROM agendamentos", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    for (const agendamento of agendamentos) {
      await pgPool.query(
        `INSERT INTO agendamentos (
          empresa, nota_fiscal, numero_pedido, centro_distribuicao, 
          data_entrega, horario_entrega, email, telefone, 
          status, data_solicitacao, confirmado_por, observacoes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          agendamento.empresa,
          agendamento.nota_fiscal,
          agendamento.numero_pedido,
          agendamento.centro_distribuicao,
          agendamento.data_entrega,
          agendamento.horario_entrega,
          agendamento.email,
          agendamento.telefone,
          agendamento.status,
          agendamento.data_solicitacao,
          agendamento.confirmado_por,
          agendamento.observacoes
        ]
      );
    }

    // 4. Verificar migração
    const totalUsuarios = await pgPool.query('SELECT COUNT(*) FROM usuarios');
    const totalAgendamentos = await pgPool.query('SELECT COUNT(*) FROM agendamentos');

    console.log('✅ Migração concluída!');
    console.log(`👥 Usuários migrados: ${totalUsuarios.rows[0].count}`);
    console.log(`📅 Agendamentos migrados: ${totalAgendamentos.rows[0].count}`);

  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

// Executar migração
migrarDados(); 