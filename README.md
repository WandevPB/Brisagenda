# Sistema de Agendamento de Entregas (SAE)

**Desenvolvido por:** Wanderson Davyd

## Sobre o Projeto

O SAE é um sistema moderno de agendamento de entregas para Centros de Distribuição, desenvolvido com tecnologias de ponta para oferecer uma experiência completa de gerenciamento de agendamentos.

## Como executar o projeto

### Pré-requisitos

- Node.js & npm instalados - [instalar com nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Passos para executar:

```sh
# Passo 1: Clone o repositório
git clone <URL_DO_SEU_REPOSITORIO>

# Passo 2: Navegue até o diretório do projeto
cd <NOME_DO_PROJETO>

# Passo 3: Instale as dependências
npm i

# Passo 4: Execute o servidor de desenvolvimento
npm run dev
```

## Tecnologias Utilizadas

Este projeto foi construído com:

- **Frontend:**
  - Vite
  - TypeScript
  - React
  - shadcn-ui
  - Tailwind CSS
  - React Router DOM
  - Axios para requisições HTTP

- **Backend:**
  - Node.js
  - Express
  - SQLite
  - JWT para autenticação
  - bcryptjs para hash de senhas
  - CORS e Helmet para segurança

## Funcionalidades

- Sistema de autenticação seguro
- Gerenciamento de agendamentos
- Dashboard administrativo
- Dashboard por instituição
- Relatórios e estatísticas
- Sistema de backup automático
- API REST completa

## Estrutura do Projeto

```
├── src/                  # Frontend React
│   ├── components/       # Componentes reutilizáveis
│   ├── pages/           # Páginas da aplicação
│   ├── services/        # Serviços de API
│   └── lib/             # Utilitários
├── backend/             # Backend Node.js
│   ├── routes/          # Rotas da API
│   ├── config/          # Configurações
│   ├── middleware/      # Middlewares
│   └── data/            # Banco de dados
└── public/              # Arquivos estáticos
```

## Autor

**Wanderson Davyd**
- Desenvolvedor Full Stack
- Especialista em React e Node.js

## Licença

Este projeto é de propriedade de Wanderson Davyd. Todos os direitos reservados.
