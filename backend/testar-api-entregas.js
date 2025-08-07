const Database = require('better-sqlite3');
const db = new Database('agendamentos.db');

// Simular a consulta que o backend faz
const agora = new Date();
const hoje = agora.getFullYear() + '-' + 
             String(agora.getMonth() + 1).padStart(2, '0') + '-' + 
             String(agora.getDate()).padStart(2, '0');

console.log('=== SIMULANDO API /entrega/hoje ===');
console.log(`📅 Data hoje: ${hoje}`);
console.log(`📅 CD: Bahia`);

// Consulta exata que o backend usa
const query = `
  SELECT * FROM agendamentos 
  WHERE centro_distribuicao = ? 
    AND data_entrega = ? 
    AND status IN ('confirmado', 'sugestao_enviada')
  ORDER BY horario_entrega ASC
`;

const entregas = db.prepare(query).all('Bahia', hoje);

console.log(`\n✅ Entregas encontradas: ${entregas.length}`);

if (entregas.length > 0) {
  console.log('\n📋 Detalhes das entregas:');
  entregas.forEach((entrega, index) => {
    console.log(`\n--- Entrega ${index + 1} ---`);
    console.log('ID:', entrega.id);
    console.log('Empresa:', entrega.empresa);
    console.log('NF:', entrega.nota_fiscal);
    console.log('Data Entrega:', entrega.data_entrega);
    console.log('Horário:', entrega.horario_entrega);
    console.log('Status:', entrega.status);
    console.log('Status Entrega:', entrega.status_entrega);
    console.log('CD:', entrega.centro_distribuicao);
  });
} else {
  console.log('\n❌ PROBLEMA: Nenhuma entrega encontrada para hoje');
  console.log('\nVamos verificar o que pode estar errado...');
  
  // Verificar se há entregas para outras datas
  const todasEntregas = db.prepare('SELECT id, empresa, nota_fiscal, data_entrega, horario_entrega, status, centro_distribuicao FROM agendamentos WHERE centro_distribuicao = ? ORDER BY data_entrega DESC').all('Bahia');
  
  console.log(`\n📊 Todas as entregas para CD Bahia (${todasEntregas.length} total):`);
  todasEntregas.forEach(e => {
    console.log(`- ${e.empresa} (NF: ${e.nota_fiscal}) - ${e.data_entrega} ${e.horario_entrega} - Status: ${e.status}`);
  });
}

// Testar se há alguma entrega com RAPIDEZ no nome
console.log('\n=== BUSCA POR "RAPIDEZ" ===');
const rapidez = db.prepare("SELECT * FROM agendamentos WHERE empresa LIKE '%RAPIDEZ%' OR empresa LIKE '%rapidez%'").all();
console.log(`Encontradas ${rapidez.length} entregas com "RAPIDEZ" no nome`);

// Inserir a entrega RAPIDEZ TRANSPORTE para teste
console.log('\n=== INSERINDO RAPIDEZ TRANSPORTE PARA TESTE ===');
try {
  const inserir = db.prepare(`
    INSERT INTO agendamentos (
      empresa, email, telefone, nota_fiscal, numero_pedido, 
      centro_distribuicao, data_entrega, horario_entrega, 
      volumes_paletes, valor_nota_fiscal, arquivo_nota_fiscal, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  inserir.run(
    'RAPIDEZ TRANSPORTE',
    'teste@rapidez.com',
    '(11) 9999-9999',
    '52152',
    'PED52152',
    'Bahia',
    hoje, // Data de hoje
    '13:00',
    '5 volumes',
    2500.00,
    'rapidez_nf.pdf',
    'confirmado'
  );
  
  console.log('✅ RAPIDEZ TRANSPORTE inserida com sucesso!');
  
  // Verificar se foi inserida
  const verificar = db.prepare(query).all('Bahia', hoje);
  console.log(`\n🔍 Após inserção, encontradas ${verificar.length} entregas para hoje:`);
  verificar.forEach(e => {
    console.log(`- ${e.empresa} (NF: ${e.nota_fiscal}) - ${e.data_entrega} ${e.horario_entrega}`);
  });
  
} catch (error) {
  console.error('❌ Erro ao inserir RAPIDEZ TRANSPORTE:', error.message);
}

db.close();
