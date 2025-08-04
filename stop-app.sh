#!/bin/bash

echo "🛑 Parando Sistema de Agendamento Brisanet"
echo "=========================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para verificar se um processo está rodando
is_running() {
    pgrep -f "$1" > /dev/null
}

# Função para matar processos
kill_process() {
    local process_name=$1
    local process_desc=$2
    
    if is_running "$process_name"; then
        echo -e "${YELLOW}🛑 Parando $process_desc...${NC}"
        pkill -f "$process_name" 2>/dev/null || true
        sleep 2
        
        # Verificar se ainda está rodando
        if is_running "$process_name"; then
            echo -e "${RED}⚠️  Forçando parada de $process_desc...${NC}"
            pkill -9 -f "$process_name" 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✅ $process_desc parado${NC}"
    else
        echo -e "${BLUE}ℹ️  $process_desc não estava rodando${NC}"
    fi
}

# Parar todos os processos relacionados
echo -e "${YELLOW}🧹 Parando todos os serviços...${NC}"

kill_process "node server.js" "Backend"
kill_process "vite" "Frontend"
kill_process "npm run dev" "Serviços npm"

# Verificar se as portas foram liberadas
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}⚠️  Porta $port ainda está em uso por $service${NC}"
        sudo fuser -k $port/tcp 2>/dev/null || true
        sleep 1
    else
        echo -e "${GREEN}✅ Porta $port liberada${NC}"
    fi
}

echo ""
echo -e "${BLUE}🔍 Verificando portas...${NC}"
check_port 3001 "Backend"
check_port 8080 "Frontend"

echo ""
echo -e "${GREEN}✅ Todos os serviços parados!${NC}"
echo "=========================================="
echo ""
echo -e "${YELLOW}💡 Para iniciar novamente:${NC}"
echo "   ./start-app.sh"
echo ""
echo -e "${BLUE}📚 Documentação: SETUP.md${NC}" 