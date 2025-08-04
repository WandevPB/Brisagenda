# 🚀 Guia de Deploy - Sistema Brisanet

## Pré-requisitos para Deploy

### 1. Configuração de Variáveis de Ambiente

#### Frontend (.env)
```
VITE_API_URL=https://seu-backend.com/api
```

#### Backend (.env)
```
NODE_ENV=production
PORT=3001
JWT_SECRET=sua-chave-secreta-muito-forte
DATABASE_URL=sqlite:./database.sqlite
```

### 2. Preparação para Produção

#### Frontend - Build
```bash
npm run build
```

#### Backend - Dependências
```bash
npm install --production
```

## 🌐 Opções de Deploy

### Opção 1: Vercel (Recomendado)
- **Frontend**: Deploy automático via Git
- **Backend**: Vercel Functions
- **Banco**: Vercel KV ou PostgreSQL

### Opção 2: Railway
- **Vantagem**: Deploy full-stack fácil
- **Banco**: PostgreSQL incluído
- **Preço**: Gratuito até 5$/mês

### Opção 3: Render
- **Frontend**: Static Site
- **Backend**: Web Service
- **Banco**: PostgreSQL gratuito

### Opção 4: DigitalOcean/AWS
- **Controle total**
- **Mais configuração necessária**

## 📦 Arquivos Necessários

### package.json (raiz)
```json
{
  "name": "brisanet-agendamento",
  "version": "1.0.0",
  "scripts": {
    "dev": "npm run dev:frontend & npm run dev:backend",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "cd backend && npm run dev",
    "build": "npm run build:frontend && npm run build:backend",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd backend && npm run build",
    "start": "cd backend && npm start"
  }
}
```

### Dockerfile (Backend)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🔧 Configuração Banco para Produção

### Substituir SQLite por PostgreSQL
```javascript
// config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

## 🛠️ Deploy Automático

### GitHub Actions (.github/workflows/deploy.yml)
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Deploy
        run: npm run deploy
```

## 🔐 Segurança para Produção

1. **Variáveis de Ambiente**
   - JWT_SECRET forte
   - DATABASE_URL segura
   - API_URL produção

2. **HTTPS Obrigatório**
   - SSL/TLS configurado
   - Redirect HTTP → HTTPS

3. **CORS Configurado**
   - Apenas domínios permitidos
   - Sem wildcard (*)

4. **Rate Limiting**
   - Já implementado
   - Ajustar limites conforme necessário

## 📊 Monitoramento

1. **Logs**
   - Winston para logs estruturados
   - Sentry para erro tracking

2. **Métricas**
   - Tempo de resposta
   - Uso de memória
   - Queries do banco

3. **Backup**
   - Backup automático do banco
   - Restore em caso de problemas 