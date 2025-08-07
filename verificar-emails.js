// Script para verificar se os templates de email estão corretos
const fs = require('fs');
const path = require('path');

const arquivoDashboard = path.join(__dirname, 'src', 'pages', 'DashboardCD.tsx');

try {
  const conteudo = fs.readFileSync(arquivoDashboard, 'utf8');
  
  console.log('🔍 Verificando templates de email...\n');
  
  // Verificar título do email de confirmação
  const tituloConfirmacao = conteudo.match(/Agendamento Confirmado - Brisa Agenda - NF.*no CD/);
  if (tituloConfirmacao) {
    console.log('✅ Título de confirmação atualizado:', tituloConfirmacao[0]);
  } else {
    console.log('❌ Título de confirmação não encontrado ou não atualizado');
  }
  
  // Verificar título do email de reagendamento
  const tituloReagendamento = conteudo.match(/Solicitação de Reagendamento - Brisa Agenda - NF.*no CD/);
  if (tituloReagendamento) {
    console.log('✅ Título de reagendamento atualizado:', tituloReagendamento[0]);
  } else {
    console.log('❌ Título de reagendamento não encontrado ou não atualizado');
  }
  
  // Verificar corpo do email de confirmação
  const corpoConfirmacao = conteudo.includes('DADOS DO AGENDAMENTO:');
  if (corpoConfirmacao) {
    console.log('✅ Corpo do email de confirmação atualizado');
  } else {
    console.log('❌ Corpo do email de confirmação não atualizado');
  }
  
  // Verificar corpo do email de reagendamento
  const corpoReagendamento = conteudo.includes('Link para novo agendamento: http://localhost:8080/agendamento');
  if (corpoReagendamento) {
    console.log('✅ Corpo do email de reagendamento atualizado');
  } else {
    console.log('❌ Corpo do email de reagendamento não atualizado');
  }
  
  console.log('\n✅ Verificação concluída!');
  console.log('\nSe ainda estiver vendo o formato antigo:');
  console.log('1. Pressione Ctrl+F5 no navegador para limpar cache');
  console.log('2. Reinicie o servidor de desenvolvimento (npm run dev)');
  console.log('3. Verifique se está na página correta do sistema');
  
} catch (error) {
  console.error('❌ Erro ao verificar arquivo:', error.message);
}
