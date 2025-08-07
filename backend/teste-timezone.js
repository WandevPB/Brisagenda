// Teste da correção de timezone
console.log('=== TESTE DE CORREÇÃO DE TIMEZONE ===');

// Função auxiliar para criar uma data local sem problemas de timezone
const criarDataLocal = (data) => {
  if (data instanceof Date) {
    return data;
  }
  
  // Se é uma string no formato YYYY-MM-DD, criar data local
  if (typeof data === 'string' && data.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [ano, mes, dia] = data.split('-').map(Number);
    return new Date(ano, mes - 1, dia); // Mês é 0-indexado
  }
  
  // Para outros formatos, usar Date normal
  return new Date(data);
};

// Teste com string YYYY-MM-DD
const dataString = '2025-08-07';
console.log('Data string:', dataString);

const dataAntiga = new Date(dataString);
console.log('Data antiga (new Date()):', dataAntiga);
console.log('Data antiga formatada local:', dataAntiga.toLocaleDateString('pt-BR'));

const dataCorrigida = criarDataLocal(dataString);
console.log('Data corrigida:', dataCorrigida);
console.log('Data corrigida formatada local:', dataCorrigida.toLocaleDateString('pt-BR'));

console.log('\n=== COMPARAÇÃO ===');
console.log('Antiga mostra:', dataAntiga.toLocaleDateString('pt-BR'));
console.log('Nova mostra:', dataCorrigida.toLocaleDateString('pt-BR'));
