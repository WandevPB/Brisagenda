const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho do banco de dados
const dbPath = path.join(__dirname, './data/agendamento.db');

// Criar conexão com o banco
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar com o banco de dados:', err);
    process.exit(1);
  } else {
    console.log('🔗 Conectado ao banco SQLite');
  }
});

// Função para verificar se uma coluna existe
const verificarColuna = (tabela, coluna) => {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tabela})`, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const colunaExiste = rows.some(row => row.name === coluna);
        resolve(colunaExiste);
      }
    });
  });
};

// Função para adicionar coluna se não existir
const adicionarColuna = (tabela, coluna, tipo, defaultValue = null) => {
  return new Promise((resolve, reject) => {
    const defaultClause = defaultValue ? ` DEFAULT ${defaultValue}` : '';
    const sql = `ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}${defaultClause}`;
    
    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`✅ Coluna '${coluna}' adicionada à tabela '${tabela}'`);
        resolve();
      }
    });
  });
};

// Função principal para verificar e corrigir a estrutura
const corrigirEstrutura = async () => {
  try {
    console.log('🔍 Verificando estrutura da tabela agendamentos...\n');

    // Verificar estrutura atual
    db.all("PRAGMA table_info(agendamentos)", async (err, rows) => {
      if (err) {
        console.error('Erro ao verificar estrutura:', err);
        process.exit(1);
      }

      console.log('📋 Estrutura atual da tabela agendamentos:');
      rows.forEach(row => {
        console.log(`  - ${row.name}: ${row.type} ${row.notnull ? '(NOT NULL)' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
      });

      console.log('\n🔧 Verificando colunas necessárias...\n');

      // Lista de colunas que devem existir
      const colunasNecessarias = [
        { nome: 'confirmado_por', tipo: 'TEXT', default: null },
        { nome: 'observacoes', tipo: 'TEXT', default: null },
        { nome: 'status_entrega', tipo: 'TEXT', default: null },
        { nome: 'data_confirmacao_entrega', tipo: 'DATETIME', default: null },
        { nome: 'confirmado_entrega_por', tipo: 'TEXT', default: null },
        { nome: 'observacoes_entrega', tipo: 'TEXT', default: null },
        { nome: 'entregue_no_horario', tipo: 'BOOLEAN', default: null },
        { nome: 'transportador_informou', tipo: 'BOOLEAN', default: null },
        { nome: 'observacoes_detalhadas', tipo: 'TEXT', default: null },
        { nome: 'horario_chegada', tipo: 'TEXT', default: null }
      ];

      // Verificar e adicionar colunas
      for (const coluna of colunasNecessarias) {
        try {
          const existe = await verificarColuna('agendamentos', coluna.nome);
          
          if (!existe) {
            console.log(`❌ Coluna '${coluna.nome}' não encontrada`);
            await adicionarColuna('agendamentos', coluna.nome, coluna.tipo, coluna.default);
          } else {
            console.log(`✅ Coluna '${coluna.nome}' já existe`);
          }
        } catch (error) {
          console.error(`Erro ao processar coluna '${coluna.nome}':`, error);
        }
      }

      console.log('\n📋 Estrutura final da tabela agendamentos:');
      db.all("PRAGMA table_info(agendamentos)", (err, finalRows) => {
        if (err) {
          console.error('Erro ao verificar estrutura final:', err);
        } else {
          finalRows.forEach(row => {
            console.log(`  - ${row.name}: ${row.type} ${row.notnull ? '(NOT NULL)' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
          });
        }

        console.log('\n🎉 Correção da estrutura concluída!');
        db.close();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Erro ao corrigir estrutura:', error);
    process.exit(1);
  }
};

// Executar correção
corrigirEstrutura();
