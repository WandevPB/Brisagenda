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
import { formatarDataBrasileira, formatarDataHoraBrasileira } from '@/lib/dateUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Eye, Download, FileText, BarChart3, TrendingUp, Calendar, 
  Building, Clock, Users, UserPlus, KeyRound, Trash2, Settings,
  MapPin, AlertCircle, CheckCircle, XCircle, ExternalLink
} from 'lucide-react';
import { agendamentoService, relatorioService, authService } from '@/services/api';

// Componentes de Tabs simples
const Tabs: React.FC<{
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}> = ({ children, value, defaultValue, onValueChange, className }) => {
  const [activeTab, setActiveTab] = React.useState(value || defaultValue || '');
  
  const handleValueChange = (newValue: string) => {
    setActiveTab(newValue);
    onValueChange?.(newValue);
  };

  return (
    <div className={className}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          if (child.type === TabsList) {
            return React.cloneElement(child as any, { 
              value: activeTab, 
              onValueChange: handleValueChange 
            });
          }
          if (child.type === TabsContent) {
            return React.cloneElement(child as any, { 
              isActive: child.props.value === activeTab 
            });
          }
        }
        return child;
      })}
    </div>
  );
};

const TabsList: React.FC<{
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}> = ({ children, value, onValueChange, className }) => (
  <div className={`flex border-b border-gray-200 mb-4 ${className || ''}`}>
    {React.Children.map(children, child => {
      if (React.isValidElement(child) && child.type === TabsTrigger) {
        return React.cloneElement(child as any, { 
          isActive: child.props.value === value,
          onClick: () => onValueChange?.(child.props.value)
        });
      }
      return child;
    })}
  </div>
);

const TabsTrigger: React.FC<{
  value: string;
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}> = ({ value, children, isActive, onClick, className }) => (
  <button
    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      isActive 
        ? 'border-orange-500 text-orange-600 bg-orange-50' 
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    } ${className || ''}`}
    onClick={onClick}
  >
    {children}
  </button>
);

const TabsContent: React.FC<{
  value: string;
  children: React.ReactNode;
  isActive?: boolean;
  className?: string;
}> = ({ value, children, isActive = true, className }) => (
  isActive ? <div className={className}>{children}</div> : null
);

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
    if (!horario || horario === 'N/A') return 'N/A';
    
    // Se já está no formato HH:mm, retornar como está
    if (horario.includes(':') && horario.length === 5) {
      return horario;
    }
    
    // Se é apenas a hora (ex: "8", "13"), formatar para "08:00", "13:00"
    const horarioLimpo = horario.toString().split(':')[0];
    const horarioPadronizado = horarioLimpo.padStart(2, '0');
    return `${horarioPadronizado}:00`;
  } catch (error) {
    console.error('Erro ao formatar horário:', error, 'Valor recebido:', horario);
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
  
  // Estados para filtros de solicitações
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroNotaFiscal, setFiltroNotaFiscal] = useState('');
  const [filtroNumeroPedido, setFiltroNumeroPedido] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroCD, setFiltroCD] = useState('');
  
  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;
  
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

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltroEmpresa('');
    setFiltroNotaFiscal('');
    setFiltroNumeroPedido('');
    setFiltroStatus('');
    setFiltroCD('');
    setPaginaAtual(1);
  };

  // Função para filtrar agendamentos
  const agendamentosFiltrados = agendamentos.filter(agendamento => {
    const matchEmpresa = filtroEmpresa === '' || agendamento.empresa?.toLowerCase().includes(filtroEmpresa.toLowerCase());
    const matchNotaFiscal = filtroNotaFiscal === '' || agendamento.nota_fiscal?.includes(filtroNotaFiscal);
    const matchNumeroPedido = filtroNumeroPedido === '' || agendamento.numero_pedido?.includes(filtroNumeroPedido);
    const matchStatus = filtroStatus === '' || agendamento.status === filtroStatus;
    const matchCD = filtroCD === '' || agendamento.centro_distribuicao === filtroCD;
    
    return matchEmpresa && matchNotaFiscal && matchNumeroPedido && matchStatus && matchCD;
  });

  // Ordenar agendamentos: pendentes primeiro, depois por data/horário
  const agendamentosOrdenados = agendamentosFiltrados
    .sort((a, b) => {
      // Primeiro critério: status (pendentes primeiro)
      if (a.status === 'pendente_confirmacao' && b.status !== 'pendente_confirmacao') return -1;
      if (b.status === 'pendente_confirmacao' && a.status !== 'pendente_confirmacao') return 1;
      
      // Segundo critério: data e horário
      const dataA = new Date(`${a.data_entrega}T${a.horario_entrega}`);
      const dataB = new Date(`${b.data_entrega}T${b.horario_entrega}`);
      return dataA.getTime() - dataB.getTime();
    });

  // Calcular paginação
  const totalPaginas = Math.ceil(agendamentosOrdenados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const agendamentosPaginados = agendamentosOrdenados.slice(indiceInicio, indiceFim);

  // Reset página quando filtros mudam
  React.useEffect(() => {
    setPaginaAtual(1);
  }, [filtroEmpresa, filtroNotaFiscal, filtroNumeroPedido, filtroStatus, filtroCD]);

  // Calcular KPIs com dados 100% reais
  const calcularKPIs = (agendamentos: Agendamento[], totalUsuarios = 0): KPIData => {
    console.log('🔍 Calculando KPIs com', agendamentos.length, 'agendamentos e', totalUsuarios, 'usuários');
    
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
    
    console.log('📊 Métricas básicas:', { totalSolicitacoes, pendentes, confirmados, reagendamentos, taxaConfirmacao });
    
    // Métricas de empresas e valores - com validação melhorada
    const empresasUnicas = new Set(agendamentos.map(ag => ag.empresa).filter(Boolean)).size;
    
    // Calcular volume total com validação numérica
    const volumeTotalNF = agendamentos.reduce((sum, ag) => {
      const valor = parseFloat(ag.valor_nota_fiscal?.toString() || '0') || 0;
      return sum + valor;
    }, 0);
    
    // Calcular média com proteção contra divisão por zero
    const mediaValorNF = totalSolicitacoes > 0 ? (volumeTotalNF / totalSolicitacoes) : 0;
    
    console.log('💰 Valores calculados:', { volumeTotalNF, mediaValorNF, totalSolicitacoes });
    
    // Agendamentos por período - usando data de solicitação
    const agendamentosHoje = agendamentos.filter(ag => {
      const dataEntrega = new Date(ag.data_entrega + 'T00:00:00');
      const hojeStr = format(hoje, 'yyyy-MM-dd');
      const entregaStr = format(dataEntrega, 'yyyy-MM-dd');
      return entregaStr === hojeStr;
    }).length;
    
    console.log('📅 Agendamentos hoje:', agendamentosHoje);

    const proximaSemana = new Date();
    proximaSemana.setDate(proximaSemana.getDate() + 7);
    const agendamentosProximaSemana = agendamentos.filter(ag => {
      const dataEntrega = new Date(ag.data_entrega + 'T00:00:00');
      return dataEntrega >= hoje && dataEntrega <= proximaSemana;
    }).length;

    // Agendamentos por mês - corrigindo para usar data_solicitacao ou created_at
    const agendamentosEsteMes = agendamentos.filter(ag => {
      const dataSolicitacao = ag.data_solicitacao ? new Date(ag.data_solicitacao) : (ag.created_at ? new Date(ag.created_at) : new Date());
      return dataSolicitacao >= inicioMesAtual && dataSolicitacao <= fimMesAtual;
    }).length;

    const agendamentosMesAnterior = agendamentos.filter(ag => {
      const dataSolicitacao = ag.data_solicitacao ? new Date(ag.data_solicitacao) : (ag.created_at ? new Date(ag.created_at) : new Date());
      return dataSolicitacao >= inicioMesAnterior && dataSolicitacao <= fimMesAnterior;
    }).length;

    console.log('📈 Crescimento mensal:', { agendamentosEsteMes, agendamentosMesAnterior });

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

    // Distribuição por horário - melhorando a formatação
    const horarioCounts = agendamentos.reduce((acc, ag) => {
      const horario = ag.horario_entrega || 'N/A';
      const horarioFormatado = formatarHorario(horario);
      acc[horarioFormatado] = (acc[horarioFormatado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const distribuicaoPorHorario = Object.entries(horarioCounts)
      .map(([horario, total]) => ({ horario, total }))
      .sort((a, b) => b.total - a.total);

    const horarioPreferido = distribuicaoPorHorario[0]?.horario || 'N/A';

    console.log('⏰ Distribuição por horário:', distribuicaoPorHorario);

    // Fornecedores mais ativos - tratando valores nulos
    const empresaCounts = agendamentos.reduce((acc, ag) => {
      const empresa = ag.empresa || 'N/A';
      if (empresa && empresa !== 'N/A') {
        acc[empresa] = (acc[empresa] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const empresasMaisAtivas = Object.entries(empresaCounts)
      .map(([empresa, total]) => ({ empresa, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    
    console.log('🏢 Fornecedores mais ativos:', empresasMaisAtivas);

    // === NOVOS KPIs DE ENTREGAS - COM LOGS DETALHADOS ===
    
    console.log('🚚 Analisando entregas...');
    
    // Entregas finalizadas (que têm confirmação de status)
    const entregasFinalizadas = agendamentos.filter(ag => ag.status_entrega && ag.status_entrega.trim() !== '');
    const totalEntregasFinalizadas = entregasFinalizadas.length;
    
    console.log('📊 Entregas finalizadas:', totalEntregasFinalizadas, 'de', totalSolicitacoes);
    
    // Contadores por status de entrega
    const entregasCompareceram = agendamentos.filter(ag => ag.status_entrega === 'compareceu').length;
    const entregasComAtraso = agendamentos.filter(ag => ag.status_entrega === 'compareceu_com_atraso').length;
    const entregasNaoCompareceram = agendamentos.filter(ag => ag.status_entrega === 'nao_compareceu').length;
    
    console.log('📈 Status entregas:', { entregasCompareceram, entregasComAtraso, entregasNaoCompareceram });
    
    // Taxa de comparecimento (compareceu + com atraso / total finalizadas)
    const taxaComparecimento = totalEntregasFinalizadas > 0 
      ? Math.round(((entregasCompareceram + entregasComAtraso) / totalEntregasFinalizadas) * 100)
      : 0;
    
    console.log('📊 Taxa de comparecimento calculada:', taxaComparecimento + '%');
    
    // Entregas pendentes de confirmação (agendadas mas sem confirmação de entrega)
    const entregasPendentesConfirmacao = agendamentos.filter(ag => {
      const isConfirmado = ag.status === 'confirmado' || ag.status === 'sugestao_enviada';
      const semStatusEntrega = !ag.status_entrega || ag.status_entrega.trim() === '';
      const dataEntrega = new Date(ag.data_entrega + 'T00:00:00');
      const jaPassou = dataEntrega <= hoje;
      
      return isConfirmado && semStatusEntrega && jaPassou;
    }).length;
    
    console.log('⏳ Entregas pendentes confirmação:', entregasPendentesConfirmacao);
    
    // Distribuição por status de entrega
    const distribuicaoStatusEntrega = [
      { status: 'Compareceu', total: entregasCompareceram, percentual: totalEntregasFinalizadas > 0 ? Math.round((entregasCompareceram / totalEntregasFinalizadas) * 100) : 0 },
      { status: 'Com Atraso', total: entregasComAtraso, percentual: totalEntregasFinalizadas > 0 ? Math.round((entregasComAtraso / totalEntregasFinalizadas) * 100) : 0 },
      { status: 'Não Compareceu', total: entregasNaoCompareceram, percentual: totalEntregasFinalizadas > 0 ? Math.round((entregasNaoCompareceram / totalEntregasFinalizadas) * 100) : 0 }
    ];
    
    // CD com melhor e pior taxa de comparecimento - com logs
    const taxasPorCD = centrosDistribuicao.map(cd => {
      const entregasCD = agendamentos.filter(ag => ag.centro_distribuicao === cd && ag.status_entrega && ag.status_entrega.trim() !== '');
      const compareceramCD = entregasCD.filter(ag => ag.status_entrega === 'compareceu' || ag.status_entrega === 'compareceu_com_atraso').length;
      const taxa = entregasCD.length > 0 ? Math.round((compareceramCD / entregasCD.length) * 100) : 0;
      
      console.log(`🏢 ${cd}: ${compareceramCD}/${entregasCD.length} entregas = ${taxa}% taxa`);
      
      return { cd, taxa, total: entregasCD.length };
    }).filter(item => item.total > 0); // Apenas CDs com entregas confirmadas
    
    const cdComMelhorTaxa = taxasPorCD.length > 0 ? taxasPorCD.sort((a, b) => b.taxa - a.taxa)[0]?.cd || 'N/A' : 'N/A';
    const cdComPiorTaxa = taxasPorCD.length > 0 ? taxasPorCD.sort((a, b) => a.taxa - b.taxa)[0]?.cd || 'N/A' : 'N/A';
    
    console.log('🏆 Melhor CD:', cdComMelhorTaxa, '/ 📉 Pior CD:', cdComPiorTaxa);

    const kpiResult = {
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
    
    console.log('✅ KPIs calculados:', kpiResult);
    return kpiResult;
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

  // Função para aplicar filtros - com tratamento melhorado de datas
  const aplicarFiltros = () => {
    console.log('🔍 Aplicando filtros:', filtrosRelatorio);
    let filtered = [...agendamentos];

    if (filtrosRelatorio.dataInicio) {
      filtered = filtered.filter(ag => {
        try {
          // Usar data_solicitacao ou created_at como fallback
          const dataSolicitacao = ag.data_solicitacao ? new Date(ag.data_solicitacao) : (ag.created_at ? new Date(ag.created_at) : null);
          if (!dataSolicitacao) return false;
          
          const dataSolicitacaoStr = format(dataSolicitacao, 'yyyy-MM-dd');
          return dataSolicitacaoStr >= filtrosRelatorio.dataInicio;
        } catch (error) {
          console.error('Erro ao filtrar por data início:', error, ag);
          return false;
        }
      });
    }

    if (filtrosRelatorio.dataFim) {
      filtered = filtered.filter(ag => {
        try {
          const dataSolicitacao = ag.data_solicitacao ? new Date(ag.data_solicitacao) : (ag.created_at ? new Date(ag.created_at) : null);
          if (!dataSolicitacao) return false;
          
          const dataSolicitacaoStr = format(dataSolicitacao, 'yyyy-MM-dd');
          return dataSolicitacaoStr <= filtrosRelatorio.dataFim;
        } catch (error) {
          console.error('Erro ao filtrar por data fim:', error, ag);
          return false;
        }
      });
    }

    if (filtrosRelatorio.centroDistribuicao && filtrosRelatorio.centroDistribuicao !== 'todos') {
      filtered = filtered.filter(ag => ag.centro_distribuicao === filtrosRelatorio.centroDistribuicao);
    }

    if (filtrosRelatorio.status && filtrosRelatorio.status !== 'todos') {
      filtered = filtered.filter(ag => ag.status === filtrosRelatorio.status);
    }

    console.log(`✅ Filtros aplicados: ${filtered.length} de ${agendamentos.length} agendamentos`);
    setFilteredAgendamentos(filtered);
    toast.success(`🔍 Filtros aplicados! ${filtered.length} solicitação(ões) encontrada(s).`);
  };

  // Exportar CSV - com tratamento melhorado de dados
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
          ag.data_entrega ? formatarDataBrasileira(ag.data_entrega) : 'N/A',
          formatarHorario(ag.horario_entrega || ''),
          formatarStatus(ag.status || ''),
          `"${ag.status_entrega ? (ag.status_entrega === 'compareceu' ? 'Compareceu' : ag.status_entrega === 'nao_compareceu' ? 'Não Compareceu' : 'Compareceu com Atraso') : 'Pendente'}"`,
          `"${(parseFloat(ag.valor_nota_fiscal?.toString() || '0') || 0).toLocaleString('pt-BR', { 
            style: 'currency', 
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}"`,
          ag.data_solicitacao ? formatarDataHoraBrasileira(ag.data_solicitacao) : (ag.created_at ? formatarDataHoraBrasileira(ag.created_at) : 'N/A')
          ].join(','))
        ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
      a.download = `relatorio_agendamentos_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
      console.log('📊 CSV exportado com sucesso:', filteredAgendamentos.length, 'registros');
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
          <p>Gerado em: ${formatarDataHoraBrasileira(new Date())}</p>
          <p>Período: ${filtrosRelatorio.dataInicio ? formatarDataBrasileira(filtrosRelatorio.dataInicio) : 'N/A'} a ${filtrosRelatorio.dataFim ? formatarDataBrasileira(filtrosRelatorio.dataFim) : 'N/A'}</p>
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
            <div>Fornecedores Cadastrados</div>
            <div class="kpi-value">${kpiData?.empresasUnicas || 0}</div>
          </div>
          <div class="kpi">
            <div>Volume Total NF</div>
            <div class="kpi-value">${(kpiData?.volumeTotalNF || 0).toLocaleString('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2 
            })}</div>
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
                 <td>${ag.data_entrega ? formatarDataBrasileira(ag.data_entrega) : 'N/A'}</td>
                 <td>${formatarHorario(ag.horario_entrega || '')}</td>
                 <td>${formatarStatus(ag.status || '')}</td>
                 <td>${ag.status_entrega ? (ag.status_entrega === 'compareceu' ? 'Compareceu' : ag.status_entrega === 'nao_compareceu' ? 'Não Compareceu' : 'Compareceu com Atraso') : 'Pendente'}</td>
                 <td>${(parseFloat(ag.valor_nota_fiscal?.toString() || '0') || 0).toLocaleString('pt-BR', { 
                   style: 'currency', 
                   currency: 'BRL',
                   minimumFractionDigits: 2,
                   maximumFractionDigits: 2
                 })}</td>
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

      // Funcionalidade temporariamente desabilitada
      toast.error('🔨 Funcionalidade em desenvolvimento');
      // const response = await authService.register(novoUsuario);
      // if (response.success) {
      //   toast.success('Usuário criado com sucesso!');
      //   setIsNovoUsuarioModalOpen(false);
      //   setNovoUsuario({ username: '', password: '', cd: 'Lagoa Nova', role: 'cd' });
      //   carregarUsuarios();
      // }
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
        // Funcionalidade temporariamente desabilitada
        toast.error('🔨 Funcionalidade em desenvolvimento');
        // const response = await authService.deleteUser(id);
        // if (response.success) {
        //   toast.success('Usuário excluído com sucesso!');
        //   carregarUsuarios();
        // }
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
                          <p className="text-sm text-gray-600 mb-1">Fornecedores Cadastrados</p>
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
                           {(kpiData.volumeTotalNF || 0).toLocaleString('pt-BR', { 
                             style: 'currency', 
                             currency: 'BRL',
                             minimumFractionDigits: 2,
                             maximumFractionDigits: 2
                           })}
                         </p>
                    </div>
                     </CardContent>
                   </Card>

                   <Card className="shadow-xl border-2 border-indigo-200 bg-gradient-to-br from-white to-indigo-50">
                     <CardContent className="pt-6">
                       <div className="text-center">
                         <p className="text-sm text-gray-600 mb-2">Valor Médio NF</p>
                         <p className="text-xl font-bold text-indigo-600">
                           {(kpiData.mediaValorNF || 0).toLocaleString('pt-BR', { 
                             style: 'currency', 
                             currency: 'BRL',
                             minimumFractionDigits: 2,
                             maximumFractionDigits: 2
                           })}
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
                         Fornecedores Mais Ativos
                       </CardTitle>
                </CardHeader>
                     <CardContent className="space-y-3">
                       {kpiData.empresasMaisAtivas.map((empresa, index) => (
                         <div key={empresa.empresa} className="flex justify-between items-center p-3 bg-rose-50 rounded-lg">
                           <div>
                             <span className="font-semibold text-rose-800 text-sm">{empresa.empresa}</span>
                             <div className="text-xs text-rose-600">
                               #{index + 1} mais ativo
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
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    (Página {paginaAtual} de {totalPaginas} - {agendamentosOrdenados.length} total)
                  </span>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Consulte e monitore todas as solicitações de agendamento do sistema (somente leitura)
                </p>
              </CardHeader>
              <CardContent>
                {/* Filtros */}
                <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="h-5 w-5 text-orange-600" />
                    <h3 className="font-semibold text-orange-600">Filtros de Pesquisa</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <Label htmlFor="filtroEmpresa">Empresa</Label>
                      <Input
                        id="filtroEmpresa"
                        placeholder="Filtrar por empresa"
                        value={filtroEmpresa}
                        onChange={(e) => setFiltroEmpresa(e.target.value)}
                        className="border-orange-200 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="filtroNotaFiscal">Nota Fiscal</Label>
                      <Input
                        id="filtroNotaFiscal"
                        placeholder="Filtrar por NF"
                        value={filtroNotaFiscal}
                        onChange={(e) => setFiltroNotaFiscal(e.target.value)}
                        className="border-orange-200 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="filtroNumeroPedido">Número do Pedido</Label>
                      <Input
                        id="filtroNumeroPedido"
                        placeholder="Filtrar por pedido"
                        value={filtroNumeroPedido}
                        onChange={(e) => setFiltroNumeroPedido(e.target.value)}
                        className="border-orange-200 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="filtroStatus">Status</Label>
                      <select
                        id="filtroStatus"
                        className="w-full p-2 border border-orange-200 rounded-md focus:border-orange-500"
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value)}
                      >
                        <option value="">Todos os status</option>
                        <option value="pendente_confirmacao">Pendente de Confirmação</option>
                        <option value="confirmado">Confirmado</option>
                        <option value="sugestao_enviada">Sugestão Enviada</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="filtroCD">Centro de Distribuição</Label>
                      <select
                        id="filtroCD"
                        className="w-full p-2 border border-orange-200 rounded-md focus:border-orange-500"
                        value={filtroCD}
                        onChange={(e) => setFiltroCD(e.target.value)}
                      >
                        <option value="">Todos os CDs</option>
                        {centrosDistribuicao.map(cd => (
                          <option key={cd} value={cd}>{cd}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button 
                      variant="outline" 
                      onClick={limparFiltros} 
                      className="flex items-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Limpar Filtros
                    </Button>
                  </div>
                </div>

                {agendamentos.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhuma solicitação encontrada</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-orange-50">
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Empresa</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">NF</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Nº Pedido</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">CD</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Data</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Status</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Status Entrega</th>
                          <th className="border border-orange-200 px-4 py-3 text-left font-semibold text-orange-800">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agendamentosPaginados.map((ag) => (
                          <tr key={ag.id} className="hover:bg-orange-50">
                            <td className="border border-orange-200 px-4 py-3">{ag.empresa || 'N/A'}</td>
                            <td className="border border-orange-200 px-4 py-3 font-mono text-sm">{ag.nota_fiscal || 'N/A'}</td>
                            <td className="border border-orange-200 px-4 py-3 font-mono text-sm">{ag.numero_pedido || 'N/A'}</td>
                            <td className="border border-orange-200 px-4 py-3">{ag.centro_distribuicao || 'N/A'}</td>
                            <td className="border border-orange-200 px-4 py-3">
                              {ag.data_entrega ? formatarDataBrasileira(ag.data_entrega) : 'N/A'}
                            </td>
                            <td className="border border-orange-200 px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(ag.status || '')}`}>
                                {formatarStatus(ag.status || '')}
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
                                Consultar
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginação */}
                  {totalPaginas > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Mostrando {indiceInicio + 1} a {Math.min(indiceFim, agendamentosOrdenados.length)} de {agendamentosOrdenados.length} solicitações
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                          disabled={paginaAtual === 1}
                          className="border-orange-300 text-orange-700 hover:bg-orange-50"
                        >
                          Anterior
                        </Button>
                        
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((pagina) => (
                            <Button
                              key={pagina}
                              variant={pagina === paginaAtual ? "default" : "outline"}
                              size="sm"
                              onClick={() => setPaginaAtual(pagina)}
                              className={pagina === paginaAtual 
                                ? "bg-orange-500 hover:bg-orange-600 text-white" 
                                : "border-orange-300 text-orange-700 hover:bg-orange-50"
                              }
                            >
                              {pagina}
                            </Button>
                          ))}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                          disabled={paginaAtual === totalPaginas}
                          className="border-orange-300 text-orange-700 hover:bg-orange-50"
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                  </>
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
                          {filteredAgendamentos.reduce((sum, ag) => {
                            const valor = parseFloat(ag.valor_nota_fiscal?.toString() || '0') || 0;
                            return sum + valor;
                          }, 0).toLocaleString('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
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
                              {formatarDataBrasileira(new Date(usuario.created_at))}
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
                        {formatarDataBrasileira(new Date(selectedAgendamento.data_entrega))}
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
                      {formatarDataHoraBrasileira(new Date(selectedAgendamento.data_solicitacao || selectedAgendamento.created_at))}
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


