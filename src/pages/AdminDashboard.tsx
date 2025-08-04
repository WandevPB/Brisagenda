import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Eye, Download, FileText, BarChart3, TrendingUp, Calendar, 
  Building, Clock, Users, UserPlus, KeyRound, Trash2, Settings,
  MapPin, AlertCircle, CheckCircle, XCircle, ExternalLink
} from 'lucide-react';
import { agendamentoService, relatorioService, authService } from '@/services/api';

interface Agendamento {
  id: string;
  empresa: string;
  nota_fiscal: string;
  numero_pedido: string;
  centro_distribuicao: string;
  data_entrega: string;
  horario_entrega: string;
  data_solicitacao: string;
  created_at?: string; // Campo adicional como fallback
  status: string;
  email?: string;
  telefone?: string;
  confirmado_por?: string;
  observacoes?: string;
  volumes_paletes?: string;
  valor_nota_fiscal?: number;
  arquivo_nota_fiscal?: string;
  // Novos campos para controle de entregas
  status_entrega?: string;
  data_confirmacao_entrega?: string;
  confirmado_entrega_por?: string;
  observacoes_entrega?: string;
  entregue_no_horario?: boolean;
  transportador_informou?: boolean;
  observacoes_detalhadas?: string;
  horario_chegada?: string;
}

interface Usuario {
  id: string;
  username: string;
  cd: string;
  role: string;
  primeira_senha: boolean;
  created_at: string;
  updated_at?: string;
}

interface KPIData {
  totalSolicitacoes: number;
  pendentes: number;
  confirmados: number;
  reagendamentos: number;
  taxaConfirmacao: number;
  empresasUnicas: number;
  volumeTotalNF: number;
  mediaValorNF: number;
  agendamentosHoje: number;
  agendamentosProximaSemana: number;
  agendamentosEsteMes: number;
  agendamentosMesAnterior: number;
  cdMaisMovimentado: string;
  horarioPreferido: string;
  crescimentoMensal: number;
  totalUsuarios: number;
  distribuicaoPorCD: Array<{cd: string, total: number, pendentes: number}>;
  distribuicaoPorHorario: Array<{horario: string, total: number}>;
  empresasMaisAtivas: Array<{empresa: string, total: number}>;
  // Novos KPIs de entregas
  totalEntregasFinalizadas: number;
  taxaComparecimento: number;
  entregasComAtraso: number;
  entregasNaoCompareceram: number;
  entregasPendentesConfirmacao: number;
  distribuicaoStatusEntrega: Array<{status: string, total: number, percentual: number}>;
  cdComMelhorTaxa: string;
  cdComPiorTaxa: string;
}

// Funções utilitárias
const formatarHorario = (horario: string): string => {
  try {
  if (!horario) return '00:00';
  const horarioLimpo = horario.toString().split(':')[0];
  const horarioPadronizado = horarioLimpo.padStart(2, '0');
  return `${horarioPadronizado}:00`;
  } catch (error) {
    console.error('Erro ao formatar horário:', error);
    return 'Formato inválido';
  }
};

const formatarStatus = (status: string): string => {
  switch (status) {
    case 'pendente_confirmacao':
      return 'Pendente';
    case 'confirmado':
      return 'Confirmado';
    case 'sugestao_enviada':
      return 'Reagendamento Sugerido';
    default:
      return status;
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pendente_confirmacao':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'confirmado':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'sugestao_enviada':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [filteredAgendamentos, setFilteredAgendamentos] = useState<Agendamento[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  
  // Estados para visualização de detalhes
  const [isDetalhesModalOpen, setIsDetalhesModalOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  
  // Estados para filtros de relatório
  const [filtrosRelatorio, setFiltrosRelatorio] = useState({
    dataInicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    dataFim: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    centroDistribuicao: 'todos',
    status: 'todos'
  });

  // Estados para gerenciamento de usuários
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [isNovoUsuarioModalOpen, setIsNovoUsuarioModalOpen] = useState(false);
  const [isAlterarSenhaModalOpen, setIsAlterarSenhaModalOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  const [novoUsuario, setNovoUsuario] = useState({
    username: '',
    password: '',
    cd: 'Lagoa Nova',
    role: 'cd'
  });
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const centrosDistribuicao = ['Lagoa Nova', 'Bahia', 'Pernambuco'];

  // Calcular KPIs com dados 100% reais
  const calcularKPIs = (agendamentos: Agendamento[], totalUsuarios = 0): KPIData => {
    const hoje = new Date();
    const inicioMesAtual = startOfMonth(hoje);
    const fimMesAtual = endOfMonth(hoje);
    const inicioMesAnterior = startOfMonth(subMonths(hoje, 1));
    const fimMesAnterior = endOfMonth(subMonths(hoje, 1));

    // Métricas básicas
    const totalSolicitacoes = agendamentos.length;
    const pendentes = agendamentos.filter(ag => ag.status === 'pendente_confirmacao').length;
    const confirmados = agendamentos.filter(ag => ag.status === 'confirmado').length;
    const reagendamentos = agendamentos.filter(ag => ag.status === 'sugestao_enviada').length;
    const taxaConfirmacao = totalSolicitacoes > 0 ? Math.round((confirmados / totalSolicitacoes) * 100) : 0;
    
    // Métricas de empresas e valores
    const empresasUnicas = new Set(agendamentos.map(ag => ag.empresa)).size;
    const volumeTotalNF = agendamentos.reduce((sum, ag) => sum + (ag.valor_nota_fiscal || 0), 0);
    const mediaValorNF = totalSolicitacoes > 0 ? volumeTotalNF / totalSolicitacoes : 0;
    
    // Agendamentos por período
    const agendamentosHoje = agendamentos.filter(ag => {
      const dataEntrega = new Date(ag.data_entrega);
      return format(dataEntrega, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd');
    }).length;

    const proximaSemana = new Date();
    proximaSemana.setDate(proximaSemana.getDate() + 7);
    const agendamentosProximaSemana = agendamentos.filter(ag => {
      const dataEntrega = new Date(ag.data_entrega);
      return dataEntrega >= hoje && dataEntrega <= proximaSemana;
    }).length;

    // Agendamentos por mês
    const agendamentosEsteMes = agendamentos.filter(ag => {
      const dataSolicitacao = new Date(ag.data_solicitacao);
      return dataSolicitacao >= inicioMesAtual && dataSolicitacao <= fimMesAtual;
    }).length;

    const agendamentosMesAnterior = agendamentos.filter(ag => {
      const dataSolicitacao = new Date(ag.data_solicitacao);
      return dataSolicitacao >= inicioMesAnterior && dataSolicitacao <= fimMesAnterior;
    }).length;

    const crescimentoMensal = agendamentosMesAnterior > 0 
      ? Math.round(((agendamentosEsteMes - agendamentosMesAnterior) / agendamentosMesAnterior) * 100)
      : agendamentosEsteMes > 0 ? 100 : 0;

    // Distribuição por CD com dados detalhados
    const distribuicaoPorCD = centrosDistribuicao.map(cd => {
      const agendamentosCD = agendamentos.filter(ag => ag.centro_distribuicao === cd);
      const pendentesCD = agendamentosCD.filter(ag => ag.status === 'pendente_confirmacao').length;
      return {
        cd,
        total: agendamentosCD.length,
        pendentes: pendentesCD
      };
    }).sort((a, b) => b.total - a.total);

    const cdMaisMovimentado = distribuicaoPorCD[0]?.cd || 'N/A';

    // Distribuição por horário
    const horarioCounts = agendamentos.reduce((acc, ag) => {
      const horario = ag.horario_entrega || 'N/A';
      acc[horario] = (acc[horario] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const distribuicaoPorHorario = Object.entries(horarioCounts)
      .map(([horario, total]) => ({ horario: formatarHorario(horario), total }))
      .sort((a, b) => b.total - a.total);

    const horarioPreferido = distribuicaoPorHorario[0]?.horario || 'N/A';

    // Empresas mais ativas
    const empresaCounts = agendamentos.reduce((acc, ag) => {
      const empresa = ag.empresa || 'N/A';
      acc[empresa] = (acc[empresa] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const empresasMaisAtivas = Object.entries(empresaCounts)
      .map(([empresa, total]) => ({ empresa, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // === NOVOS KPIs DE ENTREGAS ===
    
    // Entregas finalizadas (que têm confirmação de status)
    const entregasFinalizadas = agendamentos.filter(ag => ag.status_entrega);
    const totalEntregasFinalizadas = entregasFinalizadas.length;
    
    // Contadores por status de entrega
    const entregasCompareceram = agendamentos.filter(ag => ag.status_entrega === 'compareceu').length;
    const entregasComAtraso = agendamentos.filter(ag => ag.status_entrega === 'compareceu_com_atraso').length;
    const entregasNaoCompareceram = agendamentos.filter(ag => ag.status_entrega === 'nao_compareceu').length;
    
    // Taxa de comparecimento (compareceu + com atraso / total finalizadas)
    const taxaComparecimento = totalEntregasFinalizadas > 0 
      ? Math.round(((entregasCompareceram + entregasComAtraso) / totalEntregasFinalizadas) * 100)
      : 0;
    
    // Entregas pendentes de confirmação (agendadas mas sem confirmação de entrega)
    const entregasPendentesConfirmacao = agendamentos.filter(ag => 
      (ag.status === 'confirmado' || ag.status === 'sugestao_enviada') && 
      !ag.status_entrega &&
      new Date(ag.data_entrega) <= hoje
    ).length;
    
    // Distribuição por status de entrega
    const distribuicaoStatusEntrega = [
      { status: 'Compareceu', total: entregasCompareceram, percentual: totalEntregasFinalizadas > 0 ? Math.round((entregasCompareceram / totalEntregasFinalizadas) * 100) : 0 },
      { status: 'Com Atraso', total: entregasComAtraso, percentual: totalEntregasFinalizadas > 0 ? Math.round((entregasComAtraso / totalEntregasFinalizadas) * 100) : 0 },
      { status: 'Não Compareceu', total: entregasNaoCompareceram, percentual: totalEntregasFinalizadas > 0 ? Math.round((entregasNaoCompareceram / totalEntregasFinalizadas) * 100) : 0 }
    ];
    
    // CD com melhor e pior taxa de comparecimento
    const taxasPorCD = centrosDistribuicao.map(cd => {
      const entregasCD = agendamentos.filter(ag => ag.centro_distribuicao === cd && ag.status_entrega);
      const compareceramCD = entregasCD.filter(ag => ag.status_entrega === 'compareceu' || ag.status_entrega === 'compareceu_com_atraso').length;
      const taxa = entregasCD.length > 0 ? Math.round((compareceramCD / entregasCD.length) * 100) : 0;
      return { cd, taxa, total: entregasCD.length };
    }).filter(item => item.total > 0); // Apenas CDs com entregas confirmadas
    
    const cdComMelhorTaxa = taxasPorCD.sort((a, b) => b.taxa - a.taxa)[0]?.cd || 'N/A';
    const cdComPiorTaxa = taxasPorCD.sort((a, b) => a.taxa - b.taxa)[0]?.cd || 'N/A';

    return {
      totalSolicitacoes,
      pendentes,
      confirmados,
      reagendamentos,
      taxaConfirmacao,
      empresasUnicas,
      volumeTotalNF,
      mediaValorNF,
      agendamentosHoje,
      agendamentosProximaSemana,
      agendamentosEsteMes,
      agendamentosMesAnterior,
      cdMaisMovimentado,
      horarioPreferido,
      crescimentoMensal,
      totalUsuarios,
      distribuicaoPorCD,
      distribuicaoPorHorario,
      empresasMaisAtivas,
      // Novos KPIs de entregas
      totalEntregasFinalizadas,
      taxaComparecimento,
      entregasComAtraso,
      entregasNaoCompareceram,
      entregasPendentesConfirmacao,
      distribuicaoStatusEntrega,
      cdComMelhorTaxa,
      cdComPiorTaxa
    };
  };

  useEffect(() => {
    const initializeAdmin = async () => {
      const userData = localStorage.getItem('user');
      
      if (!userData) {
        navigate('/');
        return;
      }

      try {
        const parsedUser = JSON.parse(userData);
        
        if (parsedUser.role !== 'admin') {
          toast.error('Acesso negado! Apenas administradores podem acessar esta área.');
          navigate('/');
          return;
        }

        setUser(parsedUser);

        // Carregar dados em paralelo
        try {
          const [agendamentosResponse, usuariosResponse] = await Promise.all([
            agendamentoService.listar(),
            authService.listUsers()
          ]);

          let agendamentosData = [];
          let usuariosData = [];

          if (agendamentosResponse.success) {
            agendamentosData = agendamentosResponse.data;
            setAgendamentos(agendamentosData);
            setFilteredAgendamentos(agendamentosData);
          }
          
          if (usuariosResponse.success) {
            usuariosData = usuariosResponse.users;
            setUsuarios(usuariosData);
          }
          
          // Calcular KPIs com todos os dados carregados
          if (agendamentosData.length > 0 || usuariosData.length > 0) {
            setKpiData(calcularKPIs(agendamentosData, usuariosData.length));
          }

        } catch (error) {
          console.error('Erro ao carregar dados:', error);
          toast.error('Erro ao carregar dados');
        }
      } catch (error) {
        console.error('Erro ao parsear dados do usuário:', error);
        navigate('/');
        return;
      } finally {
        setLoading(false);
      }
    };

    initializeAdmin();
  }, [navigate]);

  // Atualizar KPIs quando dados mudarem
  useEffect(() => {
    if (agendamentos.length > 0 && usuarios.length >= 0) {
      setKpiData(calcularKPIs(agendamentos, usuarios.length));
    }
  }, [agendamentos, usuarios]);

  // Função para aplicar filtros
  const aplicarFiltros = () => {
    let filtered = [...agendamentos];

    if (filtrosRelatorio.dataInicio) {
      filtered = filtered.filter(ag => {
        const dataSolicitacao = format(new Date(ag.data_solicitacao), 'yyyy-MM-dd');
        return dataSolicitacao >= filtrosRelatorio.dataInicio;
      });
    }

    if (filtrosRelatorio.dataFim) {
      filtered = filtered.filter(ag => {
        const dataSolicitacao = format(new Date(ag.data_solicitacao), 'yyyy-MM-dd');
        return dataSolicitacao <= filtrosRelatorio.dataFim;
      });
    }

    if (filtrosRelatorio.centroDistribuicao && filtrosRelatorio.centroDistribuicao !== 'todos') {
      filtered = filtered.filter(ag => ag.centro_distribuicao === filtrosRelatorio.centroDistribuicao);
    }

    if (filtrosRelatorio.status && filtrosRelatorio.status !== 'todos') {
      filtered = filtered.filter(ag => ag.status === filtrosRelatorio.status);
    }

    setFilteredAgendamentos(filtered);
    toast.success(`🔍 Filtros aplicados! ${filtered.length} solicitação(ões) encontrada(s).`);
  };

  // Exportar CSV
  const exportarCSV = () => {
    try {
      if (filteredAgendamentos.length === 0) {
        toast.error('❌ Nenhum dado para exportar! Aplique filtros primeiro.');
        return;
      }

      const headers = ['Empresa', 'Nota Fiscal', 'Pedido', 'Centro Distribuição', 'Data Entrega', 'Horário', 'Status', 'Status Entrega', 'Valor NF', 'Solicitação'];
        const csvContent = [
          headers.join(','),
        ...filteredAgendamentos.map(ag => [
          `"${ag.empresa || 'N/A'}"`,
          `"${ag.nota_fiscal || 'N/A'}"`,
          `"${ag.numero_pedido || 'N/A'}"`,
          `"${ag.centro_distribuicao || 'N/A'}"`,
          ag.data_entrega ? format(new Date(ag.data_entrega), "dd/MM/yyyy") : 'N/A',
          formatarHorario(ag.horario_entrega || ''),
          formatarStatus(ag.status || ''),
          `"${ag.status_entrega ? (ag.status_entrega === 'compareceu' ? 'Compareceu' : ag.status_entrega === 'nao_compareceu' ? 'Não Compareceu' : 'Compareceu com Atraso') : 'Pendente'}"`,
          `"${(ag.valor_nota_fiscal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}"`,
          ag.data_solicitacao ? format(new Date(ag.data_solicitacao), "dd/MM/yyyy HH:mm") : 'N/A'
          ].join(','))
        ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
      a.download = `relatorio_agendamentos_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
      toast.success(`📊 Relatório CSV exportado com sucesso! ${filteredAgendamentos.length} registros.`);
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      toast.error('❌ Erro ao exportar CSV. Tente novamente.');
    }
  };

  // Exportar PDF (simulado - abriria uma nova janela com o relatório)
  const exportarPDF = () => {
    try {
      if (filteredAgendamentos.length === 0) {
        toast.error('❌ Nenhum dado para exportar! Aplique filtros primeiro.');
        return;
      }

      const reportWindow = window.open('', '_blank');
      if (!reportWindow) {
        toast.error('❌ Popup bloqueado! Permita popups para gerar o PDF.');
        return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Agendamentos - Brisa Agenda</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { color: #f97316; font-size: 24px; font-weight: bold; }
          .kpi { display: inline-block; margin: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; min-width: 150px; text-align: center; }
          .kpi-value { font-size: 24px; font-weight: bold; color: #f97316; }
          .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .table th { background-color: #f97316; color: white; }
          .table tr:nth-child(even) { background-color: #f9f9f9; }
          .footer { margin-top: 30px; text-align: center; color: #666; }
          @media print { 
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🚚 BRISA AGENDA - RELATÓRIO ADMINISTRATIVO</div>
          <p>Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          <p>Período: ${format(new Date(filtrosRelatorio.dataInicio), "dd/MM/yyyy")} a ${format(new Date(filtrosRelatorio.dataFim), "dd/MM/yyyy")}</p>
        </div>

        <h2>📊 Indicadores-Chave (KPIs)</h2>
        <div>
          <div class="kpi">
            <div>Total de Solicitações</div>
            <div class="kpi-value">${kpiData?.totalSolicitacoes || 0}</div>
          </div>
          <div class="kpi">
            <div>Taxa de Confirmação</div>
            <div class="kpi-value">${kpiData?.taxaConfirmacao || 0}%</div>
          </div>
          <div class="kpi">
            <div>Pendentes</div>
            <div class="kpi-value">${kpiData?.pendentes || 0}</div>
          </div>
          <div class="kpi">
            <div>Empresas Únicas</div>
            <div class="kpi-value">${kpiData?.empresasUnicas || 0}</div>
          </div>
          <div class="kpi">
            <div>Volume Total NF</div>
            <div class="kpi-value">${(kpiData?.volumeTotalNF || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
          <div class="kpi">
            <div>CD Mais Movimentado</div>
            <div class="kpi-value">${kpiData?.cdMaisMovimentado || 'N/A'}</div>
          </div>
        </div>

        <h2>🚚 Controle de Entregas</h2>
        <div>
          <div class="kpi">
            <div>Taxa de Comparecimento</div>
            <div class="kpi-value">${kpiData?.taxaComparecimento || 0}%</div>
          </div>
          <div class="kpi">
            <div>Entregas Finalizadas</div>
            <div class="kpi-value">${kpiData?.totalEntregasFinalizadas || 0}</div>
          </div>
          <div class="kpi">
            <div>Com Atraso</div>
            <div class="kpi-value">${kpiData?.entregasComAtraso || 0}</div>
          </div>
          <div class="kpi">
            <div>Não Compareceram</div>
            <div class="kpi-value">${kpiData?.entregasNaoCompareceram || 0}</div>
          </div>
          <div class="kpi">
            <div>Pendentes Confirmação</div>
            <div class="kpi-value">${kpiData?.entregasPendentesConfirmacao || 0}</div>
          </div>
          <div class="kpi">
            <div>CD Melhor Taxa</div>
            <div class="kpi-value">${kpiData?.cdComMelhorTaxa || 'N/A'}</div>
          </div>
        </div>

        <h2>📋 Detalhamento das Solicitações</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>NF</th>
              <th>CD</th>
              <th>Data Entrega</th>
              <th>Horário</th>
              <th>Status</th>
              <th>Status Entrega</th>
              <th>Valor NF</th>
            </tr>
          </thead>
          <tbody>
                         ${filteredAgendamentos.map(ag => `
               <tr>
                 <td>${ag.empresa || 'N/A'}</td>
                 <td>${ag.nota_fiscal || 'N/A'}</td>
                 <td>${ag.centro_distribuicao || 'N/A'}</td>
                 <td>${ag.data_entrega ? format(new Date(ag.data_entrega), "dd/MM/yyyy") : 'N/A'}</td>
                 <td>${formatarHorario(ag.horario_entrega || '')}</td>
                 <td>${formatarStatus(ag.status || '')}</td>
                 <td>${ag.status_entrega ? (ag.status_entrega === 'compareceu' ? 'Compareceu' : ag.status_entrega === 'nao_compareceu' ? 'Não Compareceu' : 'Compareceu com Atraso') : 'Pendente'}</td>
                 <td>${(ag.valor_nota_fiscal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
               </tr>
             `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Relatório gerado automaticamente pelo Sistema Brisa Agenda</p>
          <button class="no-print" onclick="window.print()" style="background: #f97316; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin: 20px; cursor: pointer;">🖨️ Imprimir / Salvar PDF</button>
        </div>
      </body>
      </html>
    `;

      reportWindow.document.write(htmlContent);
      reportWindow.document.close();
      
      toast.success(`📄 Relatório PDF gerado com sucesso! ${filteredAgendamentos.length} registros.`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('❌ Erro ao gerar PDF. Tente novamente.');
    }
  };

  // Gerenciamento de usuários
  const carregarUsuarios = async () => {
    try {
      setLoadingUsuarios(true);
      const response = await authService.listUsers();
      if (response.success) {
        setUsuarios(response.users);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const criarUsuario = async () => {
    try {
      if (!novoUsuario.username || !novoUsuario.password || !novoUsuario.cd) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }

      const response = await authService.register(novoUsuario);
      if (response.success) {
        toast.success('Usuário criado com sucesso!');
        setIsNovoUsuarioModalOpen(false);
        setNovoUsuario({ username: '', password: '', cd: 'Lagoa Nova', role: 'cd' });
        carregarUsuarios();
      }
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      toast.error(error.response?.data?.error || 'Erro ao criar usuário');
    }
  };

  const resetarSenha = async (username: string) => {
    if (confirm(`Resetar senha do usuário ${username}?\nNova senha será: Brisanet123`)) {
      try {
        const response = await authService.resetPassword(username);
      if (response.success) {
          toast.success(`Senha resetada para: Brisanet123`);
        carregarUsuarios();
      }
    } catch (error: any) {
        console.error('Erro ao resetar senha:', error);
        toast.error(error.response?.data?.error || 'Erro ao resetar senha');
      }
    }
  };

  const excluirUsuario = async (id: string, username: string) => {
    if (confirm(`Excluir usuário ${username}?\nEsta ação não pode ser desfeita.`)) {
      try {
        const response = await authService.deleteUser(id);
      if (response.success) {
          toast.success('Usuário excluído com sucesso!');
        carregarUsuarios();
      }
    } catch (error: any) {
        console.error('Erro ao excluir usuário:', error);
        toast.error(error.response?.data?.error || 'Erro ao excluir usuário');
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/');
    toast.success('Logout realizado com sucesso');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-orange-600 font-semibold">Carregando dashboard administrativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Header */}
      <header className="bg-white shadow-lg border-b-4 border-orange-500">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl font-bold">🚚</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Brisa Agenda Admin</h1>
                <p className="text-gray-600">Painel Administrativo Completo</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-semibold text-gray-800">👤 {user?.username}</p>
                <p className="text-sm text-gray-600">Administrador</p>
              </div>
              <Button onClick={logout} variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white">
              Sair
            </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white border-2 border-orange-200 shadow-lg">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-semibold">
              📊 Dashboard
            </TabsTrigger>
            <TabsTrigger value="solicitacoes" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-semibold">
              📋 Solicitações
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-semibold">
              📈 Relatórios
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-semibold">
              👥 Usuários
            </TabsTrigger>
          </TabsList>

          {/* Tab: Dashboard com KPIs */}
          <TabsContent value="dashboard" className="space-y-6">
            {kpiData && (
              <>
                {/* KPIs Principais */}
            <div className="grid md:grid-cols-4 gap-6">
                  <Card className="shadow-xl border-2 border-orange-200 bg-gradient-to-br from-white to-orange-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Total de Solicitações</p>
                          <p className="text-3xl font-bold text-orange-600">{kpiData.totalSolicitacoes}</p>
                        </div>
                        <FileText className="w-8 h-8 text-orange-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-xl border-2 border-green-200 bg-gradient-to-br from-white to-green-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Taxa de Confirmação</p>
                          <p className="text-3xl font-bold text-green-600">{kpiData.taxaConfirmacao}%</p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-xl border-2 border-yellow-200 bg-gradient-to-br from-white to-yellow-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Pendentes</p>
                          <p className="text-3xl font-bold text-yellow-600">{kpiData.pendentes}</p>
                        </div>
                        <AlertCircle className="w-8 h-8 text-yellow-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-xl border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Empresas Únicas</p>
                          <p className="text-3xl font-bold text-blue-600">{kpiData.empresasUnicas}</p>
                        </div>
                        <Building className="w-8 h-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                                 {/* KPIs Secundários */}
                 <div className="grid md:grid-cols-4 gap-6">
                   <Card className="shadow-xl border-2 border-cyan-200 bg-gradient-to-br from-white to-cyan-50">
                <CardContent className="pt-6">
                  <div className="text-center">
                         <p className="text-sm text-gray-600 mb-2">Reagendamentos</p>
                         <p className="text-2xl font-bold text-cyan-600">{kpiData.reagendamentos}</p>
                  </div>
                </CardContent>
              </Card>

                   <Card className="shadow-xl border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
                <CardContent className="pt-6">
                  <div className="text-center">
                         <p className="text-sm text-gray-600 mb-2">Volume Total NF</p>
                         <p className="text-xl font-bold text-purple-600">
                           {kpiData.volumeTotalNF.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                         </p>
                    </div>
                     </CardContent>
                   </Card>

                   <Card className="shadow-xl border-2 border-indigo-200 bg-gradient-to-br from-white to-indigo-50">
                     <CardContent className="pt-6">
                       <div className="text-center">
                         <p className="text-sm text-gray-600 mb-2">Valor Médio NF</p>
                         <p className="text-xl font-bold text-indigo-600">
                           {kpiData.mediaValorNF.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                         </p>
                  </div>
                </CardContent>
              </Card>

                   <Card className="shadow-xl border-2 border-pink-200 bg-gradient-to-br from-white to-pink-50">
                <CardContent className="pt-6">
                  <div className="text-center">
                         <p className="text-sm text-gray-600 mb-2">Total Usuários</p>
                         <p className="text-2xl font-bold text-pink-600">{kpiData.totalUsuarios}</p>
                    </div>
                     </CardContent>
                   </Card>
                 </div>

                 {/* KPIs Temporais */}
                 <div className="grid md:grid-cols-4 gap-6">
                   <Card className="shadow-xl border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50">
                     <CardContent className="pt-6">
                       <div className="text-center">
                         <p className="text-sm text-gray-600 mb-2">Para Hoje</p>
                         <p className="text-2xl font-bold text-emerald-600">{kpiData.agendamentosHoje}</p>
                  </div>
                </CardContent>
              </Card>

                   <Card className="shadow-xl border-2 border-teal-200 bg-gradient-to-br from-white to-teal-50">
                <CardContent className="pt-6">
                  <div className="text-center">
                         <p className="text-sm text-gray-600 mb-2">Próxima Semana</p>
                         <p className="text-2xl font-bold text-teal-600">{kpiData.agendamentosProximaSemana}</p>
                    </div>
                     </CardContent>
                   </Card>

                   <Card className="shadow-xl border-2 border-lime-200 bg-gradient-to-br from-white to-lime-50">
                     <CardContent className="pt-6">
                       <div className="text-center">
                         <p className="text-sm text-gray-600 mb-2">Este Mês</p>
                         <p className="text-2xl font-bold text-lime-600">{kpiData.agendamentosEsteMes}</p>
                       </div>
                     </CardContent>
                   </Card>

                   <Card className="shadow-xl border-2 border-amber-200 bg-gradient-to-br from-white to-amber-50">
                     <CardContent className="pt-6">
                       <div className="text-center">
                         <p className="text-sm text-gray-600 mb-2">Mês Anterior</p>
                         <p className="text-2xl font-bold text-amber-600">{kpiData.agendamentosMesAnterior}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

                {/* KPIs de Entregas */}
                <div className="mt-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    🚚 Controle de Entregas
                  </h3>
                  <div className="grid md:grid-cols-4 gap-6">
                    <Card className="shadow-xl border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Taxa de Comparecimento</p>
                            <p className="text-3xl font-bold text-emerald-600">{kpiData.taxaComparecimento}%</p>
                    </div>
                          <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

                    <Card className="shadow-xl border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Entregas Finalizadas</p>
                            <p className="text-3xl font-bold text-blue-600">{kpiData.totalEntregasFinalizadas}</p>
                    </div>
                          <FileText className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

                    <Card className="shadow-xl border-2 border-yellow-200 bg-gradient-to-br from-white to-yellow-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Com Atraso</p>
                            <p className="text-3xl font-bold text-yellow-600">{kpiData.entregasComAtraso}</p>
                          </div>
                          <Clock className="w-8 h-8 text-yellow-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-xl border-2 border-red-200 bg-gradient-to-br from-white to-red-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Não Compareceram</p>
                            <p className="text-3xl font-bold text-red-600">{kpiData.entregasNaoCompareceram}</p>
                          </div>
                          <XCircle className="w-8 h-8 text-red-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* KPIs Secundários de Entregas */}
                  <div className="grid md:grid-cols-3 gap-6 mt-6">
                    <Card className="shadow-xl border-2 border-orange-200 bg-gradient-to-br from-white to-orange-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-2">Pendentes de Confirmação</p>
                          <p className="text-2xl font-bold text-orange-600">{kpiData.entregasPendentesConfirmacao}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-xl border-2 border-green-200 bg-gradient-to-br from-white to-green-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-2">CD com Melhor Taxa</p>
                          <p className="text-lg font-bold text-green-600">{kpiData.cdComMelhorTaxa}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-xl border-2 border-red-200 bg-gradient-to-br from-white to-red-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-2">CD com Pior Taxa</p>
                          <p className="text-lg font-bold text-red-600">{kpiData.cdComPiorTaxa}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                                 {/* Insights Operacionais Detalhados */}
                 <div className="grid md:grid-cols-3 gap-6">
                   <Card className="shadow-xl border-2 border-slate-200">
                <CardHeader>
                       <CardTitle className="text-slate-700 flex items-center">
                         <MapPin className="w-5 h-5 mr-2 text-slate-600" />
                         Distribuição por CD
                       </CardTitle>
                </CardHeader>
                     <CardContent className="space-y-3">
                       {kpiData.distribuicaoPorCD.map((cd) => (
                         <div key={cd.cd} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                           <div>
                             <span className="font-semibold text-slate-800">{cd.cd}</span>
                             <div className="text-xs text-slate-600">
                               {cd.pendentes} pendentes
                    </div>
                      </div>
                           <span className="text-xl font-bold text-slate-700">{cd.total}</span>
                  </div>
                       ))}
              </CardContent>
            </Card>

                   <Card className="shadow-xl border-2 border-violet-200">
              <CardHeader>
                       <CardTitle className="text-violet-700 flex items-center">
                         <Clock className="w-5 h-5 mr-2 text-violet-600" />
                         Horários Preferidos
                       </CardTitle>
              </CardHeader>
                     <CardContent className="space-y-3">
                       {kpiData.distribuicaoPorHorario.slice(0, 5).map((horario) => (
                         <div key={horario.horario} className="flex justify-between items-center p-3 bg-violet-50 rounded-lg">
                           <span className="font-semibold text-violet-800">{horario.horario}</span>
                           <span className="text-lg font-bold text-violet-700">{horario.total}</span>
                          </div>
                        ))}
              </CardContent>
            </Card>

                   <Card className="shadow-xl border-2 border-rose-200">
                <CardHeader>
                       <CardTitle className="text-rose-700 flex items-center">
                         <Building className="w-5 h-5 mr-2 text-rose-600" />
                         Empresas Mais Ativas
                       </CardTitle>
                </CardHeader>
                     <CardContent className="space-y-3">
                       {kpiData.empresasMaisAtivas.map((empresa, index) => (
                         <div key={empresa.empresa} className="flex justify-between items-center p-3 bg-rose-50 rounded-lg">
                           <div>
                             <span className="font-semibold text-rose-800 text-sm">{empresa.empresa}</span>
                             <div className="text-xs text-rose-600">
                               #{index + 1} mais ativa
                      </div>
                    </div>
                           <span className="text-lg font-bold text-rose-700">{empresa.total}</span>
                          </div>
                        ))}
                </CardContent>
              </Card>
                 </div>

                 {/* Tendências e Crescimento */}
                 <Card className="shadow-xl border-2 border-emerald-200">
              <CardHeader>
                     <CardTitle className="text-emerald-700 flex items-center">
                       <TrendingUp className="w-5 h-5 mr-2 text-emerald-600" />
                       Análise de Crescimento
                     </CardTitle>
              </CardHeader>
              <CardContent>
                     <div className="grid md:grid-cols-3 gap-6">
                       <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                         <p className="text-sm text-emerald-600 mb-2">Crescimento Mensal</p>
                         <p className={`text-3xl font-bold ${kpiData.crescimentoMensal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                           {kpiData.crescimentoMensal >= 0 ? '+' : ''}{kpiData.crescimentoMensal}%
                         </p>
                         <p className="text-xs text-emerald-500 mt-1">vs. mês anterior</p>
                  </div>
                       <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                         <p className="text-sm text-emerald-600 mb-2">CD Mais Movimentado</p>
                         <p className="text-xl font-bold text-emerald-700">{kpiData.cdMaisMovimentado}</p>
                         <p className="text-xs text-emerald-500 mt-1">centro líder</p>
                  </div>
                       <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                         <p className="text-sm text-emerald-600 mb-2">Horário Preferido</p>
                         <p className="text-xl font-bold text-emerald-700">{kpiData.horarioPreferido}</p>
                         <p className="text-xs text-emerald-500 mt-1">mais demandado</p>
                  </div>
                </div>
              </CardContent>
            </Card>
              </>
            )}
          </TabsContent>

          {/* Tab: Solicitações */}
          <TabsContent value="solicitacoes" className="space-y-6">
            <Card className="shadow-xl border-2 border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-600 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Todas as Solicitações de Agendamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {agendamentos.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhuma solicitação encontrada</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-orange-50">
                                                <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Empresa</th>
                      <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">NF</th>
                      <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">CD</th>
                      <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Data</th>
                      <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Status</th>
                      <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Status Entrega</th>
                      <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agendamentos.map((ag) => (
                          <tr key={ag.id} className="hover:bg-orange-50">
                            <td className="border border-orange-200 px-4 py-3">{ag.empresa}</td>
                            <td className="border border-orange-200 px-4 py-3 font-mono">{ag.nota_fiscal}</td>
                            <td className="border border-orange-200 px-4 py-3">{ag.centro_distribuicao}</td>
                            <td className="border border-orange-200 px-4 py-3">
                              {format(new Date(ag.data_entrega), "dd/MM/yyyy")}
                            </td>
                            <td className="border border-orange-200 px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(ag.status)}`}>
                                {formatarStatus(ag.status)}
                              </span>
                            </td>
                            <td className="border border-orange-200 px-4 py-3">
                              {ag.status_entrega ? (
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                                  ag.status_entrega === 'compareceu' ? 'bg-green-100 text-green-800 border-green-300' :
                                  ag.status_entrega === 'nao_compareceu' ? 'bg-red-100 text-red-800 border-red-300' :
                                  'bg-yellow-100 text-yellow-800 border-yellow-300'
                                }`}>
                                  {ag.status_entrega === 'compareceu' ? 'Compareceu' : 
                                   ag.status_entrega === 'nao_compareceu' ? 'Não Compareceu' : 
                                   'Com Atraso'}
                                </span>
                              ) : (
                                <span className="text-gray-500 text-xs">Pendente</span>
                              )}
                            </td>
                            <td className="border border-orange-200 px-4 py-3">
                              <Button
                                onClick={() => {
                                  setSelectedAgendamento(ag);
                                  setIsDetalhesModalOpen(true);
                                }}
                                size="sm"
                                className="bg-orange-500 hover:bg-orange-600 text-white"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Ver
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Relatórios */}
          <TabsContent value="relatorios" className="space-y-6">
            <Card className="shadow-xl border-2 border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-600 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Filtros de Relatório
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={filtrosRelatorio.dataInicio}
                      onChange={(e) => setFiltrosRelatorio({...filtrosRelatorio, dataInicio: e.target.value})}
                      className="border-orange-200 focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={filtrosRelatorio.dataFim}
                      onChange={(e) => setFiltrosRelatorio({...filtrosRelatorio, dataFim: e.target.value})}
                      className="border-orange-200 focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Centro de Distribuição</Label>
                                         <Select value={filtrosRelatorio.centroDistribuicao || 'todos'} onValueChange={(value) => setFiltrosRelatorio({...filtrosRelatorio, centroDistribuicao: value === 'todos' ? '' : value})}>
                       <SelectTrigger className="border-orange-200 focus:border-orange-500">
                         <SelectValue placeholder="Todos os CDs" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="todos">Todos os CDs</SelectItem>
                         {centrosDistribuicao.map(cd => (
                           <SelectItem key={cd} value={cd}>{cd}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                                         <Select value={filtrosRelatorio.status || 'todos'} onValueChange={(value) => setFiltrosRelatorio({...filtrosRelatorio, status: value === 'todos' ? '' : value})}>
                       <SelectTrigger className="border-orange-200 focus:border-orange-500">
                         <SelectValue placeholder="Todos os status" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="todos">Todos os status</SelectItem>
                         <SelectItem value="pendente_confirmacao">Pendente</SelectItem>
                         <SelectItem value="confirmado">Confirmado</SelectItem>
                         <SelectItem value="sugestao_enviada">Reagendamento Sugerido</SelectItem>
                       </SelectContent>
                     </Select>
                  </div>
                </div>
                
                <div className="flex space-x-4">
                  <Button onClick={aplicarFiltros} className="bg-orange-500 hover:bg-orange-600">
                    🔍 Aplicar Filtros
                  </Button>
                                     <Button onClick={() => {
                     setFiltrosRelatorio({
                       dataInicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                       dataFim: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
                       centroDistribuicao: 'todos',
                       status: 'todos'
                     });
                     setFilteredAgendamentos(agendamentos);
                   }} variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white">
                     🔄 Limpar Filtros
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl border-2 border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-600 flex items-center">
                  <Download className="w-5 h-5 mr-2" />
                  Exportar Relatórios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Button onClick={exportarCSV} className="bg-green-500 hover:bg-green-600 h-16 text-lg">
                    <Download className="w-6 h-6 mr-2" />
                    📊 Exportar CSV
                  </Button>
                  <Button onClick={exportarPDF} className="bg-red-500 hover:bg-red-600 h-16 text-lg">
                    <FileText className="w-6 h-6 mr-2" />
                    📄 Gerar PDF
                  </Button>
                  </div>
                
                <div className="mt-8 p-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border-2 border-orange-200">
                  <h3 className="font-bold text-orange-800 mb-4 flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Resumo dos Dados Filtrados:
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-orange-200">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{filteredAgendamentos.length}</div>
                        <div className="text-sm text-orange-700">Solicitações</div>
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-orange-200">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {new Set(filteredAgendamentos.map(ag => ag.empresa)).size}
                        </div>
                        <div className="text-sm text-orange-700">Empresas</div>
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-orange-200">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {filteredAgendamentos.reduce((sum, ag) => sum + (ag.valor_nota_fiscal || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="text-sm text-orange-700">Volume Total</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Usuários */}
          <TabsContent value="usuarios" className="space-y-6">
            <Card className="shadow-xl border-2 border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-600 flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Gerenciamento de Usuários
                  </div>
                  <Button 
                    onClick={() => {
                      setIsNovoUsuarioModalOpen(true);
                      carregarUsuarios();
                    }} 
                    className="bg-green-500 hover:bg-green-600"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Novo Usuário
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingUsuarios ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Carregando usuários...</p>
                  </div>
                ) : usuarios.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhum usuário encontrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-orange-50">
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Usuário</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">CD</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Perfil</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Status</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Criado em</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map((usuario) => (
                           <tr key={usuario.id} className="hover:bg-orange-50">
                            <td className="border border-orange-200 px-4 py-3 font-semibold">{usuario.username}</td>
                            <td className="border border-orange-200 px-4 py-3">{usuario.cd || 'N/A'}</td>
                            <td className="border border-orange-200 px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                usuario.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {usuario.role === 'admin' ? 'Administrador' : 'CD'}
                              </span>
                            </td>
                            <td className="border border-orange-200 px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                usuario.primeira_senha ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {usuario.primeira_senha ? 'Primeira senha' : 'Ativo'}
                              </span>
                            </td>
                            <td className="border border-orange-200 px-4 py-3">
                              {format(new Date(usuario.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </td>
                            <td className="border border-orange-200 px-4 py-3">
                              <div className="flex space-x-2">
                              <Button
                                  onClick={() => resetarSenha(usuario.username)}
                                size="sm"
                                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                              >
                                  <KeyRound className="w-4 h-4" />
                              </Button>
                                {usuario.role !== 'admin' && (
                              <Button
                                    onClick={() => excluirUsuario(usuario.id, usuario.username)}
                                size="sm"
                    variant="destructive"
                  >
                                    <Trash2 className="w-4 h-4" />
                  </Button>
                                )}
                  </div>
                              </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal: Detalhes do Agendamento */}
      <Dialog open={isDetalhesModalOpen} onOpenChange={setIsDetalhesModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-orange-600">
              👁️ Visualização de Agendamento - {selectedAgendamento?.empresa}
            </DialogTitle>
            <p className="text-sm text-gray-600">Visualização administrativa - todos os detalhes</p>
          </DialogHeader>
          {selectedAgendamento && (
            <div className="space-y-4">
              {/* Informações de Contato */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-3">👤 Dados de Contato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <Label className="font-semibold text-gray-700">Empresa:</Label>
                    <p className="text-gray-900 font-medium">{selectedAgendamento.empresa}</p>
                    </div>
                    <div>
                    <Label className="font-semibold text-gray-700">Email:</Label>
                    <p className="text-gray-900">{selectedAgendamento.email}</p>
                    </div>
                    <div>
                    <Label className="font-semibold text-gray-700">Telefone:</Label>
                    <p className="text-gray-900">{selectedAgendamento.telefone}</p>
                    </div>
                    <div>
                    <Label className="font-semibold text-gray-700">Centro de Distribuição:</Label>
                    <p className="text-gray-900 font-medium">{selectedAgendamento.centro_distribuicao}</p>
                    </div>
                  </div>
              </div>

              {/* Informações da Nota Fiscal */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-3">📄 Dados da Nota Fiscal</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <Label className="font-semibold text-gray-700">Número da Nota Fiscal:</Label>
                    <p className="text-gray-900 font-mono text-lg">{selectedAgendamento.nota_fiscal}</p>
                    </div>
                    <div>
                    <Label className="font-semibold text-gray-700">Número do Pedido:</Label>
                    <p className="text-gray-900 font-mono text-lg">{selectedAgendamento.numero_pedido || 'Não informado'}</p>
                    </div>
                    <div>
                    <Label className="font-semibold text-gray-700">Valor da Nota Fiscal:</Label>
                    <p className="text-gray-900 font-bold text-green-700 text-lg">
                      R$ {selectedAgendamento.valor_nota_fiscal && !isNaN(Number(selectedAgendamento.valor_nota_fiscal)) ? 
                        Number(selectedAgendamento.valor_nota_fiscal).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) : 'Não informado'}
                    </p>
                    </div>
                    <div>
                    <Label className="font-semibold text-gray-700">Volumes/Paletes:</Label>
                    <p className="text-gray-900 font-medium">{selectedAgendamento.volumes_paletes || 'Não informado'}</p>
                  </div>
                </div>
              </div>

              {/* Informações de Entrega */}
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 className="font-bold text-orange-800 mb-3">🚚 Dados da Entrega</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold text-gray-700">Data Solicitada:</Label>
                    <p className="text-gray-900 font-bold text-lg">
                        {format(new Date(selectedAgendamento.data_entrega), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                    <Label className="font-semibold text-gray-700">Horário Solicitado:</Label>
                    <p className="text-gray-900 font-bold text-lg">{formatarHorario(selectedAgendamento.horario_entrega)}</p>
                    </div>
                </div>
              </div>

              {/* Status e Datas */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3">📊 Status e Timeline</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <Label className="font-semibold text-gray-700">Status Atual:</Label>
                    <Badge className={`${getStatusColor(selectedAgendamento.status)} mt-1`}>
                      {formatarStatus(selectedAgendamento.status)}
                    </Badge>
                    </div>
                    <div>
                    <Label className="font-semibold text-gray-700">Solicitação Criada em:</Label>
                    <p className="text-gray-800 font-medium">
                      {format(new Date(selectedAgendamento.data_solicitacao || selectedAgendamento.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  {selectedAgendamento.status_entrega && (
                    <div>
                      <Label className="font-semibold text-gray-700">Status de Entrega:</Label>
                      <Badge className={`mt-1 ${
                        selectedAgendamento.status_entrega === 'compareceu' ? 'bg-green-100 text-green-800 border-green-300' :
                        selectedAgendamento.status_entrega === 'nao_compareceu' ? 'bg-red-100 text-red-800 border-red-300' :
                        'bg-yellow-100 text-yellow-800 border-yellow-300'
                      }`}>
                        {selectedAgendamento.status_entrega === 'compareceu' ? 'Compareceu' : 
                         selectedAgendamento.status_entrega === 'nao_compareceu' ? 'Não Compareceu' : 
                         'Com Atraso'}
                      </Badge>
                    </div>
                  )}
                  {selectedAgendamento.confirmado_entrega_por && (
                    <div>
                      <Label className="font-semibold text-gray-700">Entrega Confirmada por:</Label>
                      <p className="text-gray-800 font-medium">{selectedAgendamento.confirmado_entrega_por}</p>
                  </div>
                  )}
                </div>
              </div>

              {/* Nota Fiscal */}
              {selectedAgendamento.arquivo_nota_fiscal && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                      📄 Nota Fiscal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-red-600" />
                        <div>
                          <p className="font-semibold text-red-800">Arquivo PDF da Nota Fiscal</p>
                          <p className="text-sm text-red-600">Clique para visualizar o documento</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => window.open(`http://localhost:3001/uploads/${selectedAgendamento.arquivo_nota_fiscal}`, '_blank')}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Observações */}
              {selectedAgendamento.observacoes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600 flex items-center gap-2">
                      💬 Observações
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-blue-800">{selectedAgendamento.observacoes}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Confirmação */}
              {selectedAgendamento.confirmado_por && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-green-600 flex items-center gap-2">
                      ✅ Confirmação
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-800">
                      <strong>Confirmado por:</strong> {selectedAgendamento.confirmado_por}
                    </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Observações de Entrega */}
              {selectedAgendamento.observacoes_entrega && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-purple-600 flex items-center gap-2">
                      📝 Observações da Entrega
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-purple-800">{selectedAgendamento.observacoes_entrega}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Novo Usuário */}
      <Dialog open={isNovoUsuarioModalOpen} onOpenChange={setIsNovoUsuarioModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-orange-600">👤 Criar Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome de Usuário *</Label>
              <Input
                value={novoUsuario.username}
                onChange={(e) => setNovoUsuario({...novoUsuario, username: e.target.value})}
                placeholder="Digite o nome de usuário"
                className="border-orange-200 focus:border-orange-500"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha *</Label>
              <Input
                type="password"
                value={novoUsuario.password}
                onChange={(e) => setNovoUsuario({...novoUsuario, password: e.target.value})}
                placeholder="Digite a senha"
                className="border-orange-200 focus:border-orange-500"
              />
            </div>
            <div className="space-y-2">
              <Label>Centro de Distribuição *</Label>
              <Select value={novoUsuario.cd} onValueChange={(value) => setNovoUsuario({...novoUsuario, cd: value})}>
                <SelectTrigger className="border-orange-200 focus:border-orange-500">
                  <SelectValue placeholder="Selecione o CD" />
                </SelectTrigger>
                <SelectContent>
                {centrosDistribuicao.map(cd => (
                    <SelectItem key={cd} value={cd}>{cd}</SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={novoUsuario.role} onValueChange={(value) => setNovoUsuario({...novoUsuario, role: value})}>
                <SelectTrigger className="border-orange-200 focus:border-orange-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cd">CD (Centro de Distribuição)</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex space-x-4 pt-4">
              <Button onClick={criarUsuario} className="bg-green-500 hover:bg-green-600 flex-1">
                <UserPlus className="w-4 h-4 mr-2" />
                Criar Usuário
              </Button>
              <Button 
                onClick={() => {
                  setIsNovoUsuarioModalOpen(false);
                  setNovoUsuario({ username: '', password: '', cd: 'Lagoa Nova', role: 'cd' });
                }} 
                variant="outline" 
                className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;


