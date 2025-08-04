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

// Middleware de autenticação
router.use(authenticateToken);

// 📅 GET /entrega/hoje - Buscar entregas agendadas para hoje
router.get('/hoje', async (req, res) => {
  try {
    const userCD = req.user.centro_distribuicao;
    const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`📅 Buscando entregas para hoje (${hoje}) - CD: ${userCD}`);

    const query = `
      SELECT * FROM agendamentos 
      WHERE centro_distribuicao = ? 
        AND data_entrega = ? 
        AND status IN ('confirmado', 'sugestao_enviada')
      ORDER BY horario_entrega ASC
    `;
    
    const entregas = await allQuery(query, [userCD, hoje]);
    console.log(`✅ Encontradas ${entregas.length} entregas para hoje`);

    res.json({
      success: true,
      data: entregas,
      total: entregas.length
    });

  } catch (error) {
    console.error('❌ Erro ao buscar entregas de hoje:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar entregas de hoje' 
    });
  }
});

// 📊 GET /entrega/pendentes - Buscar entregas pendentes de confirmação
router.get('/pendentes', async (req, res) => {
  try {
    const userCD = req.user.centro_distribuicao;
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().split('T')[0];

    console.log(`📊 Buscando entregas pendentes - CD: ${userCD}`);

    const query = `
      SELECT * FROM agendamentos 
      WHERE centro_distribuicao = ? 
        AND data_entrega >= ?
        AND status IN ('confirmado', 'sugestao_enviada')
        AND status_entrega IS NULL
      ORDER BY data_entrega ASC, horario_entrega ASC
    `;
    
    const entregas = await allQuery(query, [userCD, ontemStr]);
    console.log(`✅ Encontradas ${entregas.length} entregas pendentes`);

    res.json({
      success: true,
      data: entregas,
      total: entregas.length
    });

  } catch (error) {
    console.error('❌ Erro ao buscar entregas pendentes:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar entregas pendentes' 
    });
  }
});

// ✅ PUT /entrega/:id/confirmar - Confirmar status de entrega com dados detalhados
router.put('/:id/confirmar', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      status_entrega, 
      observacoes_entrega,
      entregue_no_horario,
      transportador_informou,
      observacoes_detalhadas,
      horario_chegada
    } = req.body;
    const userName = req.user.username;
    const userCD = req.user.centro_distribuicao;

    console.log(`🔍 Confirmando entrega ID: ${id} - Status: ${status_entrega} - Por: ${userName}`);

    // Validar status de entrega
    const statusValidos = ['compareceu', 'nao_compareceu', 'compareceu_com_atraso'];
    if (!statusValidos.includes(status_entrega)) {
      console.log(`❌ Status inválido: ${status_entrega}`);
      return res.status(400).json({
        success: false,
        error: 'Status de entrega inválido. Use: compareceu, nao_compareceu ou compareceu_com_atraso'
      });
    }

    // Verificar se o agendamento existe e pertence ao CD do usuário
    const agendamento = await getQuery(
      'SELECT * FROM agendamentos WHERE id = ? AND centro_distribuicao = ?', 
      [id, userCD]
    );

    if (!agendamento) {
      return res.status(404).json({
        success: false,
        error: 'Agendamento não encontrado ou não pertence ao seu CD'
      });
    }

    // Atualizar status de entrega com dados detalhados
    const dataConfirmacao = new Date().toISOString();
    
    const parametrosUpdate = [
      status_entrega, 
      dataConfirmacao, 
      userName, 
      observacoes_entrega || null,
      entregue_no_horario !== undefined ? entregue_no_horario : null,
      transportador_informou !== undefined ? transportador_informou : null,
      observacoes_detalhadas || null,
      horario_chegada || null,
      id
    ];
    
    const queryUpdate = `
      UPDATE agendamentos 
      SET status_entrega = ?, 
          data_confirmacao_entrega = ?, 
          confirmado_entrega_por = ?, 
          observacoes_entrega = ?,
          entregue_no_horario = ?,
          transportador_informou = ?,
          observacoes_detalhadas = ?,
          horario_chegada = ?
      WHERE id = ?
    `;
    
    await runQuery(queryUpdate, parametrosUpdate);
    console.log(`✅ Entrega ${id} confirmada com status: ${status_entrega}`);

    // Buscar dados atualizados para retorno
    const agendamentoAtualizado = await getQuery(
      'SELECT * FROM agendamentos WHERE id = ?', 
      [id]
    );

    res.json({
      success: true,
      message: `Entrega confirmada como: ${status_entrega === 'compareceu' ? 'Compareceu' : status_entrega === 'nao_compareceu' ? 'Não compareceu' : 'Compareceu com atraso'}`,
      data: agendamentoAtualizado
    });

  } catch (error) {
    console.error('❌ Erro ao confirmar entrega:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao confirmar entrega' 
    });
  }
});

// 📊 GET /entrega/estatisticas - Estatísticas de entregas para o CD
router.get('/estatisticas', async (req, res) => {
  try {
    const userCD = req.user.centro_distribuicao;
    const { periodo = '30' } = req.query; // dias

    console.log(`📊 Gerando estatísticas de entregas - CD: ${userCD} - Período: ${periodo} dias`);

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - parseInt(periodo));
    const dataInicioStr = dataInicio.toISOString().split('T')[0];

    // Estatísticas de comparecimento (TODAS as entregas confirmadas + pendentes recentes)
    const queryStats = `
      SELECT 
        COUNT(CASE WHEN status_entrega IS NOT NULL THEN 1 END) as total_entregas,
        COUNT(CASE WHEN status_entrega = 'compareceu' THEN 1 END) as compareceram,
        COUNT(CASE WHEN status_entrega = 'nao_compareceu' THEN 1 END) as nao_compareceram,
        COUNT(CASE WHEN status_entrega = 'compareceu_com_atraso' THEN 1 END) as compareceram_atraso,
        COUNT(CASE WHEN status_entrega IS NULL AND data_entrega < date('now') AND data_entrega >= ? THEN 1 END) as pendentes_confirmacao
      FROM agendamentos 
      WHERE centro_distribuicao = ? 
        AND status IN ('confirmado', 'sugestao_enviada')
    `;
    
    const row = await getQuery(queryStats, [dataInicioStr, userCD]);
    
    const total = row.total_entregas || 0;
    const compareceram = row.compareceram || 0;
    const naoCompareceram = row.nao_compareceram || 0;
    const compareceramAtraso = row.compareceram_atraso || 0;
    const pendentes = row.pendentes_confirmacao || 0;
    
    const taxaComparecimento = total > 0 ? Math.round(((compareceram + compareceramAtraso) / total) * 100) : 0;
    
    const estatisticas = {
      total_entregas: total,
      compareceram,
      nao_compareceram: naoCompareceram,
      compareceram_atraso: compareceramAtraso,
      pendentes_confirmacao: pendentes,
      taxa_comparecimento: taxaComparecimento
    };

    res.json({
      success: true,
      data: estatisticas,
      periodo_dias: parseInt(periodo),
      cd: userCD
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas de entregas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar estatísticas de entregas' 
    });
  }
});

module.exports = router; 