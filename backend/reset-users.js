const { initializeDatabase } = require('./config/database');
const bcryptjs = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function resetUsers() {
  try {
    console.log('🔄 Resetando usuários...');
    
    const dbPath = path.join(__dirname, 'data/agendamento.db');
    const db = new sqlite3.Database(dbPath);
    
    // Gerar hash da senha padrão
    const defaultPassword = 'Brisanet123';
    const defaultPasswordHash = await bcryptjs.hash(defaultPassword, 10);
    
    // Deletar usuários existentes
    console.log('🗑️ Removendo usuários antigos...');
    db.run('DELETE FROM usuarios');
    
    // Criar usuários atualizados
    console.log('👥 Criando usuários atualizados...');
    const usuarios = [
      { username: 'Bahia', password: defaultPasswordHash, role: 'institution', cd: 'Bahia' },
      { username: 'Pernambuco', password: defaultPasswordHash, role: 'institution', cd: 'Pernambuco' },
      { username: 'LagoaNova', password: defaultPasswordHash, role: 'institution', cd: 'Lagoa Nova' },
      { username: 'admin', password: defaultPasswordHash, role: 'admin', cd: 'all' },
      { username: 'PCM', password: defaultPasswordHash, role: 'consultivo', cd: 'all' },
      { username: 'Compras', password: defaultPasswordHash, role: 'consultivo', cd: 'all' },
      { username: 'Transportes', password: defaultPasswordHash, role: 'consultivo', cd: 'all' }
    ];

    usuarios.forEach(user => {
      db.run(`
        INSERT INTO usuarios (username, password, role, cd, primeira_senha)
        VALUES (?, ?, ?, ?, 1)
      `, [user.username, user.password, user.role, user.cd]);
      console.log(`✅ Usuário criado: ${user.username} (${user.role}) - CD: ${user.cd}`);
    });
    
    console.log('🎯 Reset de usuários concluído com sucesso!');
    console.log('\n📋 USUÁRIOS ATUALIZADOS:');
    console.log('• admin / Brisanet123 (Admin)');
    console.log('• Bahia / Brisanet123 (CD Bahia)');
    console.log('• Pernambuco / Brisanet123 (CD Pernambuco)');
    console.log('• LagoaNova / Brisanet123 (CD Lagoa Nova)');
    console.log('• PCM / Brisanet123 (Consultivo)');
    console.log('• Compras / Brisanet123 (Consultivo)');
    console.log('• Transportes / Brisanet123 (Consultivo)');
    
    db.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro ao resetar usuários:', error);
    process.exit(1);
  }
}

resetUsers(); 