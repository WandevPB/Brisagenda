# 🗄️ Guia de Acesso Remoto ao Banco

## 📋 Situação Atual: SQLite Local

### Acessar SQLite Localmente
```bash
# Instalar sqlite3
sudo apt-get install sqlite3

# Acessar banco
sqlite3 backend/database.sqlite

# Comandos úteis
.tables          # Listar tabelas
.schema          # Ver estrutura
SELECT * FROM usuarios;
SELECT * FROM agendamentos;
.quit            # Sair
```

### Visualizador SQLite (Interface Gráfica)
```bash
# Instalar DB Browser for SQLite
sudo apt-get install sqlitebrowser

# Abrir
sqlitebrowser backend/database.sqlite
```

## 🌐 Opções para Acesso Remoto

### Opção 1: Migrar para PostgreSQL (Recomendado)

#### 1. Instalar PostgreSQL
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Configurar
sudo -u postgres psql
CREATE DATABASE brisanet_agendamento;
CREATE USER brisanet WITH PASSWORD 'sua_senha_forte';
GRANT ALL PRIVILEGES ON DATABASE brisanet_agendamento TO brisanet;
\q
```

#### 2. Configurar Acesso Remoto
```bash
# Editar postgresql.conf
sudo nano /etc/postgresql/*/main/postgresql.conf

# Adicionar:
listen_addresses = '*'
port = 5432

# Editar pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Adicionar:
host    brisanet_agendamento    brisanet    0.0.0.0/0    md5

# Reiniciar
sudo systemctl restart postgresql
```

#### 3. Atualizar Backend
```javascript
// backend/config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'brisanet',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'brisanet_agendamento',
  password: process.env.DB_PASSWORD || 'sua_senha_forte',
  port: process.env.DB_PORT || 5432,
});

module.exports = pool;
```

### Opção 2: Banco na Nuvem (Fácil)

#### Supabase (PostgreSQL Gratuito)
1. Criar conta em https://supabase.com
2. Criar novo projeto
3. Copiar CONNECTION_STRING
4. Configurar no backend

#### PlanetScale (MySQL)
1. Criar conta em https://planetscale.com
2. Criar database
3. Copiar credenciais

#### Railway (PostgreSQL)
1. Criar conta em https://railway.app
2. Adicionar PostgreSQL
3. Configurar variáveis

### Opção 3: Tunnel SSH (Temporário)
```bash
# Criar tunnel para acessar SQLite remotamente
ssh -L 3001:localhost:3001 usuario@servidor

# Acessar via navegador
http://localhost:3001
```

## 🛠️ Script de Migração SQLite → PostgreSQL

```javascript
// migrate-to-postgres.js
const sqlite3 = require('sqlite3');
const { Pool } = require('pg');

const sqliteDb = new sqlite3.Database('backend/database.sqlite');
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  try {
    // Criar tabelas PostgreSQL
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

    // Migrar dados
    sqliteDb.all("SELECT * FROM usuarios", [], async (err, rows) => {
      if (err) throw err;
      
      for (const row of rows) {
        await pgPool.query(
          'INSERT INTO usuarios (username, password, role, centro_distribuicao) VALUES ($1, $2, $3, $4)',
          [row.username, row.password, row.role, row.centro_distribuicao]
        );
      }
    });

    console.log('Migração concluída!');
  } catch (error) {
    console.error('Erro na migração:', error);
  }
}

migrate();
```

## 🔐 Ferramentas de Administração

### pgAdmin (PostgreSQL)
```bash
# Instalar
sudo apt-get install pgadmin4

# Ou usar versão web
docker run -p 5050:80 -e PGADMIN_DEFAULT_EMAIL=admin@admin.com -e PGADMIN_DEFAULT_PASSWORD=admin dpage/pgadmin4
```

### DBeaver (Universal)
- Funciona com PostgreSQL, MySQL, SQLite
- Interface gráfica completa
- Disponível para Windows, Linux, Mac

### TablePlus (Premium)
- Interface moderna
- Suporte a múltiplos bancos
- Conecta remotamente

## 📊 Monitoramento de Banco

### Métricas Importantes
```sql
-- Número de agendamentos por dia
SELECT DATE(data_solicitacao) as data, COUNT(*) as total 
FROM agendamentos 
GROUP BY DATE(data_solicitacao) 
ORDER BY data DESC;

-- Agendamentos por centro
SELECT centro_distribuicao, COUNT(*) as total 
FROM agendamentos 
GROUP BY centro_distribuicao;

-- Status dos agendamentos
SELECT status, COUNT(*) as total 
FROM agendamentos 
GROUP BY status;
```

## 🚀 Recomendação Final

**Para Produção:**
1. **PostgreSQL na nuvem** (Supabase/Railway)
2. **Backup automático** configurado
3. **Monitoramento** ativo
4. **Acesso via pgAdmin** ou DBeaver

**Para Desenvolvimento:**
1. **SQLite local** (atual)
2. **DB Browser** para visualização
3. **Backup manual** regular 