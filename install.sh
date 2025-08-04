#!/bin/bash

echo "🚀 Instalando Sistema de Agendamento Brisanet..."
echo "================================================"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado. Instale o Node.js 18+ primeiro.${NC}"
    exit 1
fi

# Verificar versão do Node.js
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js versão 18+ é necessária. Versão atual: $(node --version)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) encontrado${NC}"

# Instalar dependências do frontend
echo -e "${YELLOW}📦 Instalando dependências do frontend...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao instalar dependências do frontend${NC}"
    exit 1
fi

# Criar arquivo de ambiente do frontend
echo -e "${YELLOW}🔧 Configurando ambiente do frontend...${NC}"
echo "VITE_API_URL=http://localhost:3001/api" > .env.development

# Instalar dependências do backend
echo -e "${YELLOW}📦 Instalando dependências do backend...${NC}"
cd backend
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao instalar dependências do backend${NC}"
    exit 1
fi

# Criar arquivo de ambiente do backend
echo -e "${YELLOW}🔧 Configurando ambiente do backend...${NC}"
cp config.env .env

# Criar diretório de dados
echo -e "${YELLOW}📁 Criando diretório de dados...${NC}"
mkdir -p data

# Voltar para diretório raiz
cd ..

echo -e "${GREEN}✅ Instalação concluída com sucesso!${NC}"
echo "================================================"
echo -e "${YELLOW}🎯 Próximos passos:${NC}"
echo ""
echo "1. Iniciar o backend:"
echo "   cd backend && npm run dev"
echo ""
echo "2. Em outro terminal, iniciar o frontend:"
echo "   npm run dev"
echo ""
echo "3. Acessar o sistema:"
echo "   http://localhost:8080"
echo ""
echo -e "${GREEN}🔐 Credenciais de acesso:${NC}"
echo "   Instituições: Paraiba, Pernambuco, Alagoas, Bahia, Sergipe"
echo "   Admin: admin"
echo "   Senha: Brisanet123 (para todos)"
echo ""
echo -e "${GREEN}📚 Documentação completa: SETUP.md${NC}" 