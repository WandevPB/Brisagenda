const express = require('express');
const jwt = require('jsonwebtoken');
const { runQuery, getQuery, allQuery } = require('../config/database');

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

// Rota para criar agendamento (público)
router.post('/', async (req, res) => {
  try {
    const {
      empresa,
      email,
      telefone,
      notaFiscal,
      numeroPedido,
      centroDistribuicao,
      dataEntrega,
      horarioEntrega,
      volumesPaletes,
      valorNotaFiscal,
      arquivoNotaFiscal
    } = req.body;

    // Validar campos obrigatórios
    if (!empresa || !email || !telefone || !notaFiscal || !numeroPedido || 
        !centroDistribuicao || !dataEntrega || !horarioEntrega || !valorNotaFiscal) {
      return res.status(400).json({ 
        error: 'Todos os campos obrigatórios devem ser preenchidos' 
      });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Email inválido' 
      });
    }

    // Validar centros de distribuição permitidos
    const centrosPermitidos = ['Bahia', 'Pernambuco', 'Lagoa Nova'];
    if (!centrosPermitidos.includes(centroDistribuicao)) {
      return res.status(400).json({ 
        error: 'Centro de distribuição inválido' 
      });
    }

    // ✅ NOVA VALIDAÇÃO: Verificar conflito de horário
    const conflito = await getQuery(`
      SELECT id, empresa, nota_fiscal 
      FROM agendamentos 
      WHERE centro_distribuicao = ? 
        AND data_entrega = ? 
        AND horario_entrega = ?
        AND status IN ('pendente_confirmacao', 'confirmado', 'sugestao_enviada')
    `, [centroDistribuicao, dataEntrega, horarioEntrega]);

    if (conflito) {
      return res.status(409).json({
        error: 'Horário já agendado',
        message: `Este horário já está ocupado por outro agendamento. Empresa: ${conflito.empresa} (NF: ${conflito.nota_fiscal}). Por favor, escolha outro horário.`,
        conflito: {
          empresa: conflito.empresa,
          nota_fiscal: conflito.nota_fiscal,
          centro_distribuicao: centroDistribuicao,
          data_entrega: dataEntrega,
          horario_entrega: horarioEntrega
        }
      });
    }

    // Inserir agendamento
    console.log(`📝 Criando agendamento:`, {
      empresa,
      centroDistribuicao,
      dataEntrega,
      horarioEntrega,
      notaFiscal
    });

    const result = await runQuery(`
      INSERT INTO agendamentos (
        empresa, email, telefone, nota_fiscal, numero_pedido,
        centro_distribuicao, data_entrega, horario_entrega,
        volumes_paletes, valor_nota_fiscal, arquivo_nota_fiscal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [empresa, email, telefone, notaFiscal, numeroPedido, 
        centroDistribuicao, dataEntrega, horarioEntrega,
        volumesPaletes, valorNotaFiscal, arquivoNotaFiscal]);

    console.log(`✅ Agendamento criado com ID: ${result.lastInsertRowid} para CD: ${centroDistribuicao}`);

    res.status(201).json({
      success: true,
      message: 'Agendamento criado com sucesso. Aguarde confirmação por email em até 48h úteis.',
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para listar agendamentos (autenticada)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, centro_distribuicao, username } = req.user;
    
    console.log(`📋 Listando agendamentos para usuário:`, {
      username,
      role,
      centro_distribuicao
    });

    let query = 'SELECT * FROM agendamentos';
    let params = [];

    // Usuários consultivos e admin veem todos os agendamentos
    // Usuários institution veem apenas do seu centro de distribuição
    if (role !== 'admin' && role !== 'consultivo') {
      query += ' WHERE centro_distribuicao = ?';
      params.push(centro_distribuicao);
      console.log(`🔍 Filtrando agendamentos para CD: ${centro_distribuicao}`);
    } else {
      console.log(`👁️ Usuário ${role} vê todos os agendamentos`);
    }

    query += ' ORDER BY data_solicitacao DESC';

    const agendamentos = await allQuery(query, params);

    console.log(`✅ Retornando ${agendamentos.length} agendamentos para ${username}`);

    res.json({
      success: true,
      data: agendamentos
    });

  } catch (error) {
    console.error('❌ Erro ao listar agendamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para buscar agendamento por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, centro_distribuicao } = req.user;

    let query = 'SELECT * FROM agendamentos WHERE id = ?';
    let params = [id];

    // Usuários consultivos e admin veem todos os agendamentos
    // Usuários institution veem apenas do seu centro de distribuição
    if (role !== 'admin' && role !== 'consultivo') {
      query += ' AND centro_distribuicao = ?';
      params.push(centro_distribuicao);
    }

    const agendamento = await getQuery(query, params);

    if (!agendamento) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json({
      success: true,
      data: agendamento
    });

  } catch (error) {
    console.error('Erro ao buscar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para atualizar status do agendamento
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, observacoes } = req.body;
    const { role, centro_distribuicao, username } = req.user;

    // ✅ RESTRIÇÃO: Usuários consultivos não podem alterar status
    if (role === 'consultivo') {
      return res.status(403).json({ 
        error: 'Acesso negado',
        message: 'Usuários consultivos não podem alterar o status dos agendamentos'
      });
    }

    // Validar status
    const statusValidos = ['pendente_confirmacao', 'confirmado', 'sugestao_enviada'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    // Verificar se o agendamento existe e se o usuário tem permissão
    let checkQuery = 'SELECT * FROM agendamentos WHERE id = ?';
    let checkParams = [id];

    if (role !== 'admin') {
      checkQuery += ' AND centro_distribuicao = ?';
      checkParams.push(centro_distribuicao);
    }

    const agendamento = await getQuery(checkQuery, checkParams);

    if (!agendamento) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    // Atualizar status
    const result = await runQuery(`
      UPDATE agendamentos 
      SET status = ?, confirmado_por = ?, observacoes = ?
      WHERE id = ?
    `, [status, username, observacoes || null, id]);

    res.json({
      success: true,
      message: 'Status atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para sugerir novo horário
router.patch('/:id/sugerir-horario', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { dataEntrega, horarioEntrega, observacoes } = req.body;
    const { role, centro_distribuicao, username } = req.user;

    // Validar campos
    if (!dataEntrega || !horarioEntrega) {
      return res.status(400).json({ error: 'Data e horário são obrigatórios' });
    }

    // Verificar se o agendamento existe e se o usuário tem permissão
    let checkQuery = 'SELECT * FROM agendamentos WHERE id = ?';
    let checkParams = [id];

    if (role !== 'admin') {
      checkQuery += ' AND centro_distribuicao = ?';
      checkParams.push(centro_distribuicao);
    }

    const agendamento = await getQuery(checkQuery, checkParams);

    if (!agendamento) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    // ✅ NOVA VALIDAÇÃO: Verificar conflito de horário na sugestão
    const conflito = await getQuery(`
      SELECT id, empresa, nota_fiscal 
      FROM agendamentos 
      WHERE centro_distribuicao = ? 
        AND data_entrega = ? 
        AND horario_entrega = ?
        AND status IN ('pendente_confirmacao', 'confirmado', 'sugestao_enviada')
        AND id != ?
    `, [agendamento.centro_distribuicao, dataEntrega, horarioEntrega, id]);

    if (conflito) {
      return res.status(409).json({
        error: 'Horário já agendado',
        message: `Este horário já está ocupado por outro agendamento. Empresa: ${conflito.empresa} (NF: ${conflito.nota_fiscal}). Por favor, escolha outro horário.`,
        conflito: {
          empresa: conflito.empresa,
          nota_fiscal: conflito.nota_fiscal,
          centro_distribuicao: agendamento.centro_distribuicao,
          data_entrega: dataEntrega,
          horario_entrega: horarioEntrega
        }
      });
    }

    // Atualizar com nova sugestão
    const result = await runQuery(`
      UPDATE agendamentos 
      SET data_entrega = ?, horario_entrega = ?, status = 'sugestao_enviada', 
          confirmado_por = ?, observacoes = ?
      WHERE id = ?
    `, [dataEntrega, horarioEntrega, username, observacoes || null, id]);

    res.json({
      success: true,
      message: 'Sugestão de horário enviada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao sugerir horário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para relatórios (admin)
router.get('/relatorios/csv', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { dataInicio, dataFim, centroDistribuicao } = req.query;

    let query = `
      SELECT 
        empresa,
        email,
        telefone,
        nota_fiscal,
        numero_pedido,
        centro_distribuicao,
        data_entrega,
        horario_entrega,
        status,
        data_solicitacao,
        confirmado_por
      FROM agendamentos
      WHERE 1=1
    `;
    let params = [];

    // Filtros opcionais
    if (dataInicio) {
      query += ' AND date(data_solicitacao) >= ?';
      params.push(dataInicio);
    }

    if (dataFim) {
      query += ' AND date(data_solicitacao) <= ?';
      params.push(dataFim);
    }

    if (centroDistribuicao) {
      query += ' AND centro_distribuicao = ?';
      params.push(centroDistribuicao);
    }

    query += ' ORDER BY data_solicitacao DESC';

    const agendamentos = await allQuery(query, params);

    res.json({
      success: true,
      data: agendamentos,
      total: agendamentos.length
    });

  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para estatísticas (admin)
router.get('/relatorios/estatisticas', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Total de agendamentos
    const total = await getQuery('SELECT COUNT(*) as total FROM agendamentos');
    
    // Por status
    const porStatus = await allQuery(`
      SELECT status, COUNT(*) as total 
      FROM agendamentos 
      GROUP BY status
    `);

    // Por centro de distribuição
    const porCD = await allQuery(`
      SELECT centro_distribuicao, COUNT(*) as total 
      FROM agendamentos 
      GROUP BY centro_distribuicao
    `);

    // Agendamentos hoje
    const hoje = new Date().toISOString().split('T')[0];
    const agendamentosHoje = await getQuery(`
      SELECT COUNT(*) as total 
      FROM agendamentos 
      WHERE date(data_entrega) = ?
    `, [hoje]);

    res.json({
      success: true,
      data: {
        total: total.total,
        porStatus,
        porCD,
        agendamentosHoje: agendamentosHoje.total
      }
    });

  } catch (error) {
    console.error('Erro ao gerar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router; 