# Backend - Sistema de Agendamento Brisanet

## Configuração

### 1. Instalar dependências
```bash
cd backend
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `config.env` para `.env` ou defina as variáveis:
```bash
cp config.env .env
```

### 3. Executar em desenvolvimento
```bash
npm run dev
```

### 4. Executar em produção
```bash
npm start
```

## Endpoints da API

### Autenticação
- `POST /api/auth/login` - Login com usuário e senha
- `GET /api/auth/validate` - Validar token JWT

### Agendamentos
- `POST /api/agendamentos` - Criar novo agendamento (público)
- `GET /api/agendamentos` - Listar agendamentos (autenticado)
- `GET /api/agendamentos/:id` - Buscar agendamento por ID
- `PATCH /api/agendamentos/:id/status` - Atualizar status do agendamento
- `PATCH /api/agendamentos/:id/sugerir-horario` - Sugerir novo horário

### Relatórios (Admin)
- `GET /api/agendamentos/relatorios/csv` - Dados para relatório CSV
- `GET /api/agendamentos/relatorios/estatisticas` - Estatísticas gerais

## Usuários Predefinidos

- **Instituições**: Paraiba, Pernambuco, Alagoas, Bahia, Sergipe
- **Admin**: admin
- **Senha**: Brisanet123 (para todos)

## Limpeza Automática

O sistema executa uma limpeza automática todo dia 1 de cada mês às 02:00, removendo dados com mais de 30 dias.

## Estrutura do Banco

### Tabela: usuarios
- id, username, password, role, centro_distribuicao, created_at

### Tabela: agendamentos
- id, empresa, email, telefone, nota_fiscal, numero_pedido, centro_distribuicao, data_entrega, horario_entrega, status, data_solicitacao, confirmado_por, observacoes 