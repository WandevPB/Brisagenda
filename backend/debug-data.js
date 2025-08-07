const sqlite3 = require('better-sqlite3');
const db = sqlite3('agendamentos.db');

console.log('=== VERIFICANDO SE HÁ AGENDAMENTOS ===');
try {
  const count = db.prepare('SELECT COUNT(*) as total FROM agendamentos').get();
  console.log('Total de agendamentos:', count.total);
  
  if (count.total > 0) {
    console.log('\n=== ÚLTIMOS 5 AGENDAMENTOS ===');
    const agendamentos = db.prepare('SELECT id, empresa, data_entrega, data_solicitacao FROM agendamentos ORDER BY id DESC LIMIT 5').all();
    console.table(agendamentos);
  }
} catch (error) {
  console.log('Erro ao consultar agendamentos:', error.message);
}

console.log('\n=== TESTE DE FORMATO DE DATA ===');
// Simulando como uma data é salva
const dataHoje = new Date();
console.log('Data JS atual:', dataHoje);
console.log('Data ISO:', dataHoje.toISOString());
console.log('Data local string:', dataHoje.toLocaleDateString('pt-BR'));

// Testando como o banco interpreta uma data
const testData = '2025-08-07';
console.log('\nTeste com data YYYY-MM-DD:', testData);
const parsedDate = new Date(testData);
console.log('Parseada como Date:', parsedDate);
console.log('Como string local:', parsedDate.toLocaleDateString('pt-BR'));

// Testando conversões de timezone
console.log('\n=== PROBLEMA DE TIMEZONE ===');
const dataTest = new Date('2025-08-07');
console.log('new Date("2025-08-07"):', dataTest);
console.log('UTC String:', dataTest.toUTCString());
console.log('Local String:', dataTest.toLocaleDateString('pt-BR'));
console.log('ISO String:', dataTest.toISOString());

db.close();
