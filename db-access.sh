#!/bin/bash

# 🗄️ Script de Acesso ao Banco Brisanet

echo "🗄️ Brisanet - Acesso ao Banco de Dados"
echo "====================================="

# Verificar se o banco existe
if [ ! -f "backend/database.sqlite" ]; then
    echo "❌ Banco de dados não encontrado!"
    echo "Execute o backend primeiro: cd backend && npm run dev"
    exit 1
fi

echo "📊 Banco encontrado: backend/database.sqlite"
echo ""

# Menu de opções
echo "Escolha uma opção:"
echo "1) Acessar via linha de comando (sqlite3)"
echo "2) Instalar e abrir DB Browser (interface gráfica)"
echo "3) Ver estatísticas rápidas"
echo "4) Backup do banco"
echo "5) Sair"
echo ""

read -p "Digite sua opção (1-5): " option

case $option in
    1)
        echo "🔧 Abrindo sqlite3..."
        echo "Comandos úteis:"
        echo "  .tables          - Ver tabelas"
        echo "  .schema          - Ver estrutura"
        echo "  SELECT * FROM usuarios;     - Ver usuários"
        echo "  SELECT * FROM agendamentos; - Ver agendamentos"
        echo "  .quit            - Sair"
        echo ""
        sqlite3 backend/database.sqlite
        ;;
    2)
        echo "📦 Instalando DB Browser for SQLite..."
        
        # Detectar sistema operacional
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo apt-get update
            sudo apt-get install -y sqlitebrowser
            echo "✅ DB Browser instalado!"
            echo "🚀 Abrindo banco..."
            sqlitebrowser backend/database.sqlite &
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            if command -v brew &> /dev/null; then
                brew install --cask db-browser-for-sqlite
                echo "✅ DB Browser instalado!"
                echo "🚀 Abrindo banco..."
                open -a "DB Browser for SQLite" backend/database.sqlite
            else
                echo "❌ Homebrew não encontrado. Instale manualmente de:"
                echo "https://sqlitebrowser.org/dl/"
            fi
        else
            echo "❌ Sistema não suportado automaticamente."
            echo "Download manual: https://sqlitebrowser.org/dl/"
        fi
        ;;
    3)
        echo "📈 Estatísticas do Banco:"
        echo "========================"
        
        # Contar usuários
        usuarios=$(sqlite3 backend/database.sqlite "SELECT COUNT(*) FROM usuarios;")
        echo "👥 Usuários cadastrados: $usuarios"
        
        # Contar agendamentos
        agendamentos=$(sqlite3 backend/database.sqlite "SELECT COUNT(*) FROM agendamentos;")
        echo "📅 Agendamentos totais: $agendamentos"
        
        # Agendamentos por status
        echo ""
        echo "📊 Agendamentos por Status:"
        sqlite3 backend/database.sqlite "SELECT status, COUNT(*) as total FROM agendamentos GROUP BY status;"
        
        # Agendamentos por centro
        echo ""
        echo "🏢 Agendamentos por Centro:"
        sqlite3 backend/database.sqlite "SELECT centro_distribuicao, COUNT(*) as total FROM agendamentos GROUP BY centro_distribuicao;"
        
        echo ""
        echo "📅 Últimos 5 agendamentos:"
        sqlite3 backend/database.sqlite "SELECT empresa, centro_distribuicao, data_entrega, status FROM agendamentos ORDER BY data_solicitacao DESC LIMIT 5;"
        ;;
    4)
        echo "💾 Fazendo backup..."
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_file="backup_database_${timestamp}.sqlite"
        
        cp backend/database.sqlite "$backup_file"
        echo "✅ Backup criado: $backup_file"
        echo "📁 Localização: $(pwd)/$backup_file"
        ;;
    5)
        echo "👋 Saindo..."
        exit 0
        ;;
    *)
        echo "❌ Opção inválida!"
        ;;
esac 