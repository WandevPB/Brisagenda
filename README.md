# 🚚 Sistema de Agendamento Brisanet

Sistema moderno de agendamento de entregas para Centros de Distribuição da Brisanet, desenvolvido com React, TypeScript, Node.js e SQLite.

## ✨ Funcionalidades

### 🔐 Sistema de Autenticação
- Login com JWT
- Diferentes níveis de acesso (Admin, CD, Consultivo)
- Reset de senhas
- Controle de primeira senha

### 📋 Agendamentos
- Criação de agendamentos
- Confirmação de horários
- Reagendamentos
- Upload de notas fiscais
- Controle de status

### 🚚 Controle de Entregas
- Confirmação de comparecimento
- Registro de atrasos
- Observações detalhadas
- Relatórios de entregas

### 📊 Dashboard Administrativo
- KPIs em tempo real
- Relatórios detalhados
- Exportação CSV/PDF
- Gestão de usuários

### 🎯 Dashboard por CD
- Visualização específica por centro
- Controle de entregas
- Confirmação de agendamentos

## 🛠️ Tecnologias

### Frontend
- **React 18** com TypeScript
- **Vite** para build e desenvolvimento
- **Tailwind CSS** para estilização
- **Shadcn/ui** para componentes
- **React Router** para navegação
- **React Hook Form** para formulários
- **Zod** para validação
- **Lucide React** para ícones

### Backend
- **Node.js** com Express
- **SQLite3** para banco de dados
- **JWT** para autenticação
- **bcryptjs** para hash de senhas
- **Multer** para upload de arquivos
- **node-cron** para tarefas agendadas

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação Automática (Linux)
```bash
# Tornar scripts executáveis
chmod +x *.sh

# Instalação automática
./setup-linux.sh

# Iniciar sistema
./start-app.sh
```

### Instalação Manual
```bash
# 1. Instalar dependências do frontend
npm install

# 2. Configurar ambiente do frontend
echo "VITE_API_URL=http://localhost:3001/api" > .env.development

# 3. Instalar dependências do backend
cd backend
npm install

# 4. Configurar ambiente do backend
cat > .env << EOF
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:8080
JWT_SECRET=brisanet_agendamento_jwt_secret_key_2024
DATABASE_PATH=./data/agendamento.db
EOF

# 5. Criar diretórios necessários
mkdir -p data uploads backups

# 6. Voltar para diretório raiz
cd ..
```

## 🎯 Execução

### Iniciar Sistema Completo
```bash
./start-app.sh
```

### Iniciar Serviços Separadamente
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
npm run dev
```

### Parar Sistema
```bash
./stop-app.sh
```

## 📱 Acesso ao Sistema

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/api/health

## 🔐 Credenciais de Acesso

### Instituições (CDs)
- **Bahia**: admin / Brisanet123
- **Pernambuco**: admin / Brisanet123
- **Lagoa Nova**: admin / Brisanet123

### Administrador
- **Usuário**: admin
- **Senha**: Brisanet123

### Consultivo
- **PCM**: admin / Brisanet123
- **Compras**: admin / Brisanet123
- **Transportes**: admin / Brisanet123

## 📊 KPIs Disponíveis

### Principais
- Total de Solicitações
- Taxa de Confirmação
- Pendentes
- **Fornecedores** (antes "Empresas Únicas")

### Secundários
- Reagendamentos
- Volume Total NF
- Valor Médio NF
- Total Usuários

### Temporais
- Agendamentos para Hoje
- Próxima Semana
- Este Mês
- Mês Anterior

### Entregas
- Taxa de Comparecimento
- Entregas Finalizadas
- Com Atraso
- Não Compareceram

## 🗃️ Estrutura do Banco

### Tabela `usuarios`
- id, username, password, role, cd, primeira_senha, created_at, updated_at

### Tabela `agendamentos`
- id, empresa, email, telefone, nota_fiscal, numero_pedido
- centro_distribuicao, data_entrega, horario_entrega
- volumes_paletes, valor_nota_fiscal, arquivo_nota_fiscal
- status, data_solicitacao, confirmado_por, observacoes
- status_entrega, data_confirmacao_entrega, confirmado_entrega_por
- observacoes_entrega, entregue_no_horario, transportador_informou
- observacoes_detalhadas, horario_chegada

## 🔧 Scripts Úteis

### Setup e Instalação
- `setup-linux.sh` - Instalação automática para Linux
- `start-app.sh` - Iniciar sistema completo
- `stop-app.sh` - Parar sistema
- `health-check.sh` - Verificar saúde do sistema

### Backend
- `reset-users.js` - Resetar usuários do sistema
- `migrate-to-production.js` - Migração para produção

## 📁 Estrutura do Projeto

```
Brisa_Agenda/
├── src/                    # Frontend React
│   ├── components/        # Componentes reutilizáveis
│   ├── pages/            # Páginas da aplicação
│   ├── services/         # Serviços da API
│   └── utils/            # Utilitários
├── backend/              # API Node.js
│   ├── config/          # Configurações
│   ├── routes/          # Rotas da API
│   ├── middleware/      # Middlewares
│   ├── data/           # Banco SQLite
│   └── uploads/        # Arquivos enviados
├── public/              # Arquivos estáticos
├── scripts/             # Scripts de automação
└── docs/               # Documentação
```

## 🚨 Troubleshooting

### Problemas Comuns

#### Backend não inicia
```bash
# Verificar se a porta 3001 está livre
lsof -i :3001

# Verificar logs
tail -f backend/server.log
```

#### Frontend não conecta
```bash
# Verificar arquivo .env.development
cat .env.development

# Deve conter: VITE_API_URL=http://localhost:3001/api
```

#### Banco não inicializa
```bash
# Verificar permissões
chmod 755 backend/data
chmod 755 backend/uploads
```

## 📈 Melhorias Implementadas

### ✅ Otimizações para Linux
- Scripts de instalação automática
- Detecção de distribuição Linux
- Configuração automática de ambiente
- Scripts de gerenciamento de serviços

### ✅ Alterações de Terminologia
- "Empresas Únicas" → "Fornecedores"
- "Empresas Mais Ativas" → "Fornecedores Mais Ativos"
- Atualização em todos os KPIs e interfaces

### ✅ Correções de Bugs
- Correção do erro `db.prepare is not a function`
- Compatibilidade com SQLite3
- Tratamento robusto de erros

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👥 Autores

- **Brisanet** - Desenvolvimento inicial
- **Equipe de Desenvolvimento** - Manutenção e melhorias

## 📞 Suporte

Para suporte técnico ou dúvidas:
- Verifique a documentação em `docs/`
- Consulte os logs do sistema
- Entre em contato com a equipe de desenvolvimento

---

**Sistema de Agendamento Brisanet** - Versão 2.0.0
*Desenvolvido com ❤️ para otimizar o controle de entregas*
