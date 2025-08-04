# 🌐 Guia de Deploy para Produção

## 🎯 **Onde seus dados ficam em produção:**

### **📊 Resumo das Opções:**

| Opção | Onde ficam os dados | Backup | Custo | Facilidade |
|-------|---------------------|--------|-------|------------|
| **Supabase** | Servidores AWS (EUA/Europa) | Automático | Grátis até 500MB | ⭐⭐⭐⭐⭐ |
| **Railway** | Servidores Railway (Global) | Automático | $5/mês | ⭐⭐⭐⭐⭐ |
| **PlanetScale** | Servidores PlanetScale | Automático | Grátis até 1GB | ⭐⭐⭐⭐ |
| **VPS/AWS** | Seu servidor privado | Manual | $5-50/mês | ⭐⭐⭐ |

## 🚀 **Opção 1: Supabase (RECOMENDADO)**

### **Passos:**

1. **Criar conta:** https://supabase.com
2. **Criar projeto** → Escolher região (preferencialmente próxima ao Brasil)
3. **Copiar URL de conexão** no painel
4. **Configurar backend:**

```javascript
// backend/.env
NODE_ENV=production
DATABASE_URL=postgresql://postgres:SUA_SENHA@db.PROJETO.supabase.co:5432/postgres
JWT_SECRET=sua-chave-super-secreta-aqui
```

5. **Migrar dados:**
```bash
npm install pg
node migrate-to-production.js
```

### **Vantagens:**
- ✅ **Localização**: Servidores no mundo todo
- ✅ **Backup**: Automático diário
- ✅ **Interface**: Dashboard web para gerenciar
- ✅ **Gratuito**: Até 500MB de dados
- ✅ **Segurança**: SSL/TLS automático

## 🚀 **Opção 2: Railway**

### **Passos:**

1. **Criar conta:** https://railway.app
2. **Conectar GitHub** com seu repositório
3. **Adicionar PostgreSQL** no projeto
4. **Copiar DATABASE_URL** das variáveis
5. **Deploy automático** via Git

### **Vantagens:**
- ✅ **Deploy automático** a cada push no Git
- ✅ **PostgreSQL incluído**
- ✅ **Monitoramento** built-in
- ✅ **Logs** em tempo real

## 🔄 **Processo de Migração:**

### **1. Backup Local:**
```bash
# Fazer backup antes de migrar
./db-access.sh
# Escolher opção 4 (Backup)
```

### **2. Configurar Produção:**
```javascript
// backend/config/database.js (substituir SQLite)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = pool;
```

### **3. Atualizar package.json:**
```json
{
  "dependencies": {
    "pg": "^8.11.0"
  }
}
```

### **4. Migrar Dados:**
```bash
# Instalar dependências
npm install pg

# Configurar URL do banco
export DATABASE_URL="postgresql://user:pass@host:5432/database"

# Executar migração
node migrate-to-production.js
```

## 📍 **Onde Exatamente Ficam os Dados:**

### **Supabase:**
```
🌍 Localização: AWS (Virginia, Frankfurt, Sydney, etc.)
🔐 Segurança: Criptografia AES-256
📂 Estrutura: PostgreSQL 15
🔄 Backup: Diário automático por 7 dias
```

### **Railway:**
```
🌍 Localização: Google Cloud (Multi-região)
🔐 Segurança: Criptografia em trânsito e repouso
📂 Estrutura: PostgreSQL 14
🔄 Backup: Contínuo com point-in-time recovery
```

## 🔒 **Segurança dos Dados:**

### **Criptografia:**
- ✅ **Em trânsito**: TLS 1.2+
- ✅ **Em repouso**: AES-256
- ✅ **Acesso**: Apenas via credenciais

### **Compliance:**
- ✅ **SOC 2 Type II**
- ✅ **ISO 27001**
- ✅ **GDPR Compliant**

## 📊 **Monitoramento:**

### **Métricas Importantes:**
```sql
-- Verificar dados migrados
SELECT 
  'usuarios' as tabela, COUNT(*) as total FROM usuarios
UNION ALL
SELECT 
  'agendamentos' as tabela, COUNT(*) as total FROM agendamentos;

-- Verificar integridade
SELECT centro_distribuicao, COUNT(*) 
FROM agendamentos 
GROUP BY centro_distribuicao;
```

## 🆘 **Plano de Contingência:**

### **Se algo der errado:**

1. **Backup local sempre disponível:**
   ```bash
   # Restaurar do backup
   cp backup_database_20241201_*.sqlite backend/database.sqlite
   ```

2. **Rollback para SQLite:**
   ```javascript
   // Reverter para SQLite temporariamente
   const sqlite3 = require('sqlite3');
   const db = new sqlite3.Database('database.sqlite');
   ```

3. **Dupla verificação:**
   - Testar login admin
   - Verificar agendamentos
   - Testar criação de novos registros

## 🎯 **Resumo Final:**

**Para a Brisanet, recomendo:**

1. **🥇 Supabase** - Mais fácil e gratuito
2. **🥈 Railway** - Mais profissional ($5/mês)

**Seus dados estarão:**
- 🌍 **Geograficamente**: Servidores na nuvem global
- 🔒 **Segurança**: Criptografados e protegidos
- 📂 **Backup**: Automático e redundante
- 🔄 **Acesso**: Via URL de conexão segura

**O sistema funcionará igual ao que você tem agora, mas:**
- ✅ Escalável para milhares de usuários
- ✅ Backup automático
- ✅ Disponível 24/7
- ✅ Sem perda de dados em deploy 