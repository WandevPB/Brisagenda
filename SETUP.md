# Setup do Sistema de Agendamento Brisanet

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn

## 🚀 Configuração Completa

### 1. Frontend (React)

```bash
# Instalar dependências
npm install

# Criar arquivo de variáveis de ambiente
echo "VITE_API_URL=http://localhost:3001/api" > .env.development

# Executar em desenvolvimento
npm run dev
```

### 2. Backend (Node.js + SQLite)

```bash
# Navegar para o diretório do backend
cd backend

# Instalar dependências
npm install

# Criar arquivo de variáveis de ambiente
cp config.env .env

# Executar em desenvolvimento
npm run dev
```

## 🔧 Executar em Produção

### Backend
```bash
cd backend
npm start
```

### Frontend
```bash
npm run build
npm run preview
```

## 📊 Estrutura do Projeto

```
entrega-facil-agendamento-main/
├── backend/                    # API Node.js
│   ├── config/
│   │   └── database.js        # Configuração SQLite
│   ├── routes/
│   │   ├── auth.js           # Rotas de autenticação
│   │   └── agendamentos.js   # Rotas de agendamentos
│   ├── package.json
│   └── server.js             # Servidor principal
├── src/                       # Frontend React
│   ├── services/
│   │   └── api.ts            # Serviços da API
│   ├── pages/                # Páginas da aplicação
│   └── components/           # Componentes reutilizáveis
└── package.json
```

## 🔐 Credenciais de Acesso

- **Instituições**: Paraiba, Pernambuco, Alagoas, Bahia, Sergipe
- **Admin**: admin
- **Senha**: Brisanet123 (para todos)

## 📈 Funcionalidades Implementadas

### ✅ Concluídas
- ✅ Sistema de login com JWT
- ✅ Criação de agendamentos
- ✅ Dashboard das instituições
- ✅ Painel administrativo
- ✅ Banco de dados SQLite
- ✅ Limpeza automática mensal
- ✅ Relatórios CSV
- ✅ API REST completa

### 🔄 Processo
- 🔄 Integração completa frontend/backend
- 🔄 Validações robustas
- 🔄 Tratamento de erros

## 🗃️ Banco de Dados

O sistema usa SQLite para simplicidade. O banco é criado automaticamente em `backend/data/agendamento.db`.

### Tabelas:
- `usuarios` - Credenciais de login
- `agendamentos` - Dados dos agendamentos

## 🧹 Limpeza Automática

O sistema remove automaticamente dados com mais de 30 dias todo dia 1 de cada mês às 02:00.

## 📧 Próximos Passos

1. **Testar integração completa**
2. **Validar todas as funcionalidades**
3. **Deploy em produção**
4. **Configurar domínio**
5. **Backup automático**

## 🐛 Troubleshooting

### Backend não inicia
```bash
# Verificar se a porta 3001 está livre
lsof -i :3001

# Verificar logs
cd backend && npm run dev
```

### Frontend não conecta com backend
```bash
# Verificar se o arquivo .env.development existe
cat .env.development

# Deve conter: VITE_API_URL=http://localhost:3001/api
```

### Banco não inicializa
```bash
# Verificar permissões do diretório
mkdir -p backend/data
chmod 755 backend/data
```

## 📞 Suporte

Para questões técnicas, verifique:
1. Logs do console (F12)
2. Logs do backend
3. Conectividade de rede
4. Permissões de arquivo 