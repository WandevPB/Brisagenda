const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getQuery, runQuery } = require('../config/database');

const router = express.Router();

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_aqui', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Rota de login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validar entrada
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Usuário e senha são obrigatórios' 
      });
    }

    // Buscar usuário no banco
    const user = await getQuery(
      'SELECT * FROM usuarios WHERE username = ?',
      [username]
    );

    if (!user) {
      return res.status(401).json({ 
        error: 'Usuário ou senha incorretos. Em caso de erro, contate o suporte: wanderson.goncalves' 
      });
    }

    // Verificar senha
    let senhaValida = false;
    
    // Verificar se a senha está em hash ou texto plano (para migração)
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      // Senha em hash
      senhaValida = await bcrypt.compare(password, user.password);
    } else {
      // Senha em texto plano (para migração gradual)
      senhaValida = password === user.password;
      
      // Se a senha está correta mas em texto plano, migrar para hash
      if (senhaValida) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await runQuery(
          'UPDATE usuarios SET password = ? WHERE id = ?',
          [hashedPassword, user.id]
        );
      }
    }

    if (!senhaValida) {
      return res.status(401).json({ 
        error: 'Usuário ou senha incorretos. Em caso de erro, contate o suporte: wanderson.goncalves' 
      });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        centro_distribuicao: user.cd 
      },
      process.env.JWT_SECRET || 'sua_chave_secreta_aqui',
      { expiresIn: '24h' }
    );

    // Resposta de sucesso
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        centro_distribuicao: user.cd,
        primeira_senha: user.primeira_senha
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor. Em caso de erro, contate o suporte: wanderson.goncalves' 
    });
  }
});

// Rota para trocar senha no primeiro acesso
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { novaSenha } = req.body;
    const userId = req.user.id;

    if (!novaSenha || novaSenha.length < 6) {
      return res.status(400).json({ 
        error: 'Nova senha deve ter pelo menos 6 caracteres' 
      });
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(novaSenha, 10);

    // Atualizar senha e marcar como não sendo mais primeira senha
    await runQuery(
      'UPDATE usuarios SET password = ?, primeira_senha = 0 WHERE id = ?',
      [hashedPassword, userId]
    );

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor. Em caso de erro, contate o suporte: wanderson.goncalves' 
    });
  }
});

// Rota para admin resetar senha de usuário
router.post('/reset-password', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Apenas administradores podem resetar senhas' 
      });
    }

    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ 
        error: 'Nome de usuário é obrigatório' 
      });
    }

    // Hash da senha padrão
    const hashedPassword = await bcrypt.hash('Brisanet123', 10);

    // Resetar senha para padrão e marcar como primeira senha
    const result = await runQuery(
      'UPDATE usuarios SET password = ?, primeira_senha = 1 WHERE username = ?',
      [hashedPassword, username]
    );

    if (result.changes === 0) {
      return res.status(404).json({ 
        error: 'Usuário não encontrado' 
      });
    }

    res.json({
      success: true,
      message: 'Senha resetada com sucesso para: Brisanet123'
    });

  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// Rota para listar usuários (admin)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Apenas administradores podem listar usuários' 
      });
    }

    const users = await getQuery(
      'SELECT id, username, role, cd, primeira_senha, created_at FROM usuarios ORDER BY username',
      [],
      true // all results
    );

    res.json({
      success: true,
      users
    });

  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// Rota para validar token
router.get('/validate', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_aqui');
    
    res.json({
      valid: true,
      user: {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
        centro_distribuicao: decoded.centro_distribuicao
      }
    });

  } catch (error) {
    res.status(401).json({ 
      valid: false, 
      error: 'Token inválido' 
    });
  }
});

module.exports = router; 