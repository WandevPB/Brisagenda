const express = require('express');
const jwt = require('jsonwebtoken');
const { runQuery, getQuery, allQuery } = require('../config/database');

const router = express.Router();

// Log all requests to this router
router.use((req, res, next) => {
  console.log('Agendamentos Router - Request:', req.method, req.originalUrl);
  console.log('Query params:', req.query);
  next();
});

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

// Rota para verificar horários disponíveis
router.get('/horarios-disponiveis', async (req, res) => {
  console.log('Rota /horarios-disponiveis foi chamada');
  console.log('URL completa:', req.originalUrl);
  console.log('Query params:', req.query);
  console.log('Headers:', req.headers);
  const { data, centroDistribuicao } = req.query;
  
  if (!data || !centroDistribuicao) {
    return res.status(400).json({ error: 'Data e Centro de Distribuição são obrigatórios' });
  }

  try {
    // Buscar agendamentos existentes
    const agendamentosExistentes = await allQuery(
      'SELECT horario_entrega FROM agendamentos WHERE data_entrega = ? AND centro_distribuicao = ? AND status != "CANCELADO"',
      [data, centroDistribuicao]
    );

    // Buscar horários bloqueados
    const horariosBloquados = await allQuery(`
      SELECT horario_inicio, horario_fim 
      FROM bloqueios_horarios 
      WHERE data_bloqueio = ? 
      AND centro_distribuicao = ?
    `, [data, centroDistribuicao]);

    console.log('🔍 Debug - Data:', data);
    console.log('🔍 Debug - Centro Distribuição:', centroDistribuicao);
    console.log('🔍 Debug - Horários bloqueados encontrados:', horariosBloquados);

    const horariosDisponiveis = [
      '08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00'
    ];

    console.log('Agendamentos existentes:', agendamentosExistentes);
    console.log('Horários bloqueados:', horariosBloquados);
    
    const horariosLivres = horariosDisponiveis.filter(horario => {
      // Verificar se o horário não está ocupado por um agendamento
      const temAgendamento = agendamentosExistentes.some(ag => ag.horario_entrega === horario);
      if (temAgendamento) return false;

      // Verificar se o horário não está em um período bloqueado
      const horarioEmMinutos = parseInt(horario.split(':')[0]) * 60 + parseInt(horario.split(':')[1]);
      const estaBloqueado = horariosBloquados.some(bloqueio => {
        const inicioEmMinutos = parseInt(bloqueio.horario_inicio.split(':')[0]) * 60 + parseInt(bloqueio.horario_inicio.split(':')[1]);
        const fimEmMinutos = parseInt(bloqueio.horario_fim.split(':')[0]) * 60 + parseInt(bloqueio.horario_fim.split(':')[1]);
        return horarioEmMinutos >= inicioEmMinutos && horarioEmMinutos < fimEmMinutos;
      });

      return !estaBloqueado;
    });

    return res.json({
      horariosLivres,
      totalDisponiveis: horariosLivres.length
    });
  } catch (error) {
    console.error('Erro ao buscar horários:', error);
    return res.status(500).json({ error: 'Erro ao buscar horários disponíveis' });
  }
});

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

    console.log('� BACKEND - Recebendo agendamento para data:', dataEntrega);
    console.log('� BACKEND - Empresa:', empresa, 'CD:', centroDistribuicao);

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

    // Verificar se o horário está disponível
    const agendamentoExistente = await getQuery(
      'SELECT * FROM agendamentos WHERE data_entrega = ? AND horario_entrega = ? AND centro_distribuicao = ? AND status != "CANCELADO"',
      [dataEntrega, horarioEntrega, centroDistribuicao]
    );

    if (agendamentoExistente) {
      return res.status(400).json({
        error: 'Este horário já está ocupado para o CD selecionado. Por favor, escolha outro horário.'
      });
    }
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

// ======= ROTAS DE BLOQUEIOS (ANTES DA ROTA /:id) =======
// Rota para listar bloqueios
router.get('/bloqueios', authenticateToken, async (req, res) => {
  try {
    const { role, centro_distribuicao: cd } = req.user;
    const { data } = req.query;

    console.log('🔍 Listando bloqueios - User:', { role, cd }, 'Query:', { data });

    let query = `
      SELECT bh.*, a.empresa, a.nota_fiscal
      FROM bloqueios_horarios bh
      LEFT JOIN agendamentos a ON bh.agendamento_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (data) {
      query += ' AND bh.data_bloqueio = ?';
      params.push(data);
    }

    // Filtrar por CD se não for admin
    if (role !== 'admin') {
      query += ' AND bh.centro_distribuicao = ?';
      params.push(cd);
    }

    query += ' ORDER BY bh.data_bloqueio DESC, bh.horario_inicio ASC';

    console.log('🔍 Query SQL:', query);
    console.log('🔍 Params:', params);

    const bloqueios = await allQuery(query, params);

    console.log('✅ Bloqueios encontrados:', bloqueios.length);

    res.json({
      success: true,
      data: bloqueios
    });

  } catch (error) {
    console.error('❌ Erro ao listar bloqueios:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// Rota para remover bloqueio
router.delete('/bloqueios/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, centro_distribuicao: cd } = req.user;

    // Verificar se o bloqueio existe e pertence ao CD
    const bloqueio = await getQuery(
      'SELECT * FROM bloqueios_horarios WHERE id = ?' + (role !== 'admin' ? ' AND centro_distribuicao = ?' : ''),
      role !== 'admin' ? [id, cd] : [id]
    );

    if (!bloqueio) {
      return res.status(404).json({ error: 'Bloqueio não encontrado' });
    }

    await runQuery('DELETE FROM bloqueios_horarios WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Bloqueio removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover bloqueio:', error);
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

// Rota para bloquear horários
router.post('/bloquear-horarios', authenticateToken, async (req, res) => {
  try {
    const { agendamentoId, horarioInicio, horarioFim, motivo, data } = req.body;
    const { role, centro_distribuicao: userCD, username } = req.user;

    console.log('🔒 Dados recebidos para bloqueio:', { agendamentoId, horarioInicio, horarioFim, motivo, data, userCD, role });

    // Validar campos obrigatórios
    if (!horarioInicio || !horarioFim || !motivo || !data) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios',
        message: 'Todos os campos são obrigatórios: data, horarioInicio, horarioFim e motivo'
      });
    }

    // Apenas usuários CD podem bloquear horários (role = 'institution' é o CD)
    if (role !== 'admin' && role !== 'institution') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Apenas usuários CD podem bloquear horários'
      });
    }

    // Usar a data fornecida diretamente
    const dataEntrega = data;

    console.log('🔒 Validando bloqueio para:', { userCD, dataEntrega, horarioInicio, horarioFim });

    // Validar se já existe bloqueio para este período
    const bloqueioExistente = await getQuery(`
      SELECT id FROM bloqueios_horarios 
      WHERE centro_distribuicao = ? 
      AND data_bloqueio = ?
      AND (
        (horario_inicio <= ? AND horario_fim > ?) OR
        (horario_inicio < ? AND horario_fim >= ?) OR
        (horario_inicio >= ? AND horario_fim <= ?)
      )
    `, [userCD, dataEntrega, horarioInicio, horarioInicio, horarioFim, horarioFim, horarioInicio, horarioFim]);

    if (bloqueioExistente) {
      return res.status(400).json({
        success: false,
        error: 'Conflito de horários',
        message: 'Já existe um bloqueio cadastrado que conflita com este período'
      });
    }

    // Inserir bloqueio
    console.log('🔒 Inserindo bloqueio com dados:', [agendamentoId || null, userCD, dataEntrega, horarioInicio, horarioFim, motivo, username]);
    
    const result = await runQuery(`
      INSERT INTO bloqueios_horarios (
        agendamento_id, centro_distribuicao, data_bloqueio,
        horario_inicio, horario_fim, motivo, criado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [agendamentoId || null, userCD, dataEntrega, horarioInicio, horarioFim, motivo, username]);

    console.log('✅ Bloqueio criado com ID:', result.lastID);
    
    // Verificar se foi inserido corretamente
    const bloqueioInserido = await getQuery(`
      SELECT * FROM bloqueios_horarios WHERE id = ?
    `, [result.lastID]);
    
    console.log('🔍 Bloqueio inserido verificado:', bloqueioInserido);

    res.status(201).json({
      success: true,
      message: 'Horários bloqueados com sucesso',
      id: result.lastID
    });

  } catch (error) {
    console.error('❌ Erro ao bloquear horários:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
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

    // Agendamentos hoje - usar horário local correto
    const agora = new Date();
    const hoje = agora.getFullYear() + '-' + 
                 String(agora.getMonth() + 1).padStart(2, '0') + '-' + 
                 String(agora.getDate()).padStart(2, '0');
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