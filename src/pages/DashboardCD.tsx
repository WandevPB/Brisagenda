import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Eye, LogOut, FileText, ExternalLink, Filter, X, Check, 
  AlertTriangle, CalendarIcon, Mail, Clock, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { agendamentoService, entregaService } from '@/services/api';
import { cn } from "@/lib/utils";

interface Agendamento {
  id: string;
  empresa: string;
  nota_fiscal: string;
  numero_pedido: string;
  centro_distribuicao: string;
  data_entrega: string;
  horario_entrega: string;
  data_solicitacao: string;
  status: string;
  email?: string;
  telefone?: string;
  confirmado_por?: string;
  observacoes?: string;
  volumes_paletes?: string;
  valor_nota_fiscal?: number;
  arquivo_nota_fiscal?: string;
  // Campos para controle de entregas
  status_entrega?: string;
  data_confirmacao_entrega?: string;
  confirmado_entrega_por?: string;
  observacoes_entrega?: string;
  // Novos campos detalhados
  entregue_no_horario?: boolean;
  transportador_informou?: boolean;
  observacoes_detalhadas?: string;
  horario_chegada?: string;
}

interface EstatisticasEntrega {
  total_entregas: number;
  compareceram: number;
  nao_compareceram: number;
  compareceram_atraso: number;
  pendentes_confirmacao: number;
  taxa_comparecimento: number;
}

// Função para formatar horário
const formatarHorario = (horario: string): string => {
  if (!horario) return 'Não informado';
  try {
    if (horario.includes(':')) return horario;
    if (horario.length === 4) {
      return `${horario.substring(0, 2)}:${horario.substring(2)}`;
    }
    return horario;
  } catch (error) {
    console.error('Erro ao formatar horário:', error);
    return 'Formato inválido';
  }
};

// Função para formatar status
const formatarStatus = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    'pendente_confirmacao': 'Pendente de Confirmação',
    'confirmado': 'Confirmado',
    'sugestao_enviada': 'Sugestão Enviada'
  };
  return statusMap[status] || status;
};

// Função para cor do status
const getStatusColor = (status: string): string => {
  const colorMap: { [key: string]: string } = {
    'pendente_confirmacao': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'confirmado': 'bg-green-100 text-green-800 border-green-200',
    'sugestao_enviada': 'bg-blue-100 text-blue-800 border-blue-200'
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const DashboardCD = () => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [modalReagendamentoAberto, setModalReagendamentoAberto] = useState(false);
  const [novaDataSugerida, setNovaDataSugerida] = useState<Date>();
  const [novoHorarioSugerido, setNovoHorarioSugerido] = useState('');
  const [motivoReagendamento, setMotivoReagendamento] = useState('');
  const [observacoesAprovacao, setObservacoesAprovacao] = useState('');
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [aguardandoEmail, setAguardandoEmail] = useState(false);
  const [tipoEmailPendente, setTipoEmailPendente] = useState<'confirmacao' | 'reagendamento' | null>(null);
  const [dadosReagendamento, setDadosReagendamento] = useState<{
    novaData: Date;
    novoHorario: string;
    motivo: string;
  } | null>(null);

  // Estados para entregas
  const [entregasHoje, setEntregasHoje] = useState<Agendamento[]>([]);
  const [entregasPendentes, setEntregasPendentes] = useState<Agendamento[]>([]);
  const [estatisticasEntrega, setEstatisticasEntrega] = useState<EstatisticasEntrega | null>(null);
  const [modalConfirmarEntrega, setModalConfirmarEntrega] = useState(false);
  const [entregaSelecionada, setEntregaSelecionada] = useState<Agendamento | null>(null);
  const [observacoesEntrega, setObservacoesEntrega] = useState('');
  const [processandoEntrega, setProcessandoEntrega] = useState(false);

  // Estados para modais detalhados
  const [modalEntregueDetalhes, setModalEntregueDetalhes] = useState(false);
  const [modalNaoVeioDetalhes, setModalNaoVeioDetalhes] = useState(false);
  const [entregueNoHorario, setEntregueNoHorario] = useState<boolean | null>(null);
  const [transportadorInformou, setTransportadorInformou] = useState<boolean | null>(null);
  const [observacoesDetalhadas, setObservacoesDetalhadas] = useState('');
  const [horarioChegada, setHorarioChegada] = useState('');
  
  const navigate = useNavigate();

  // Obter dados do usuário
  const userDataString = localStorage.getItem('user');
  const userData = userDataString ? JSON.parse(userDataString) : null;
  const userCD = userData?.cd || '';
  const userName = userData?.username || 'Usuário';

  const horariosDisponiveis = [
    '08:00', '09:00', '10:00', '13:00', '14:00', '15:00'
  ];

  useEffect(() => {
    carregarAgendamentos();
    carregarDadosEntregas();
  }, []);

  // Carregar dados de entregas
  const carregarDadosEntregas = async () => {
    try {
      const [entregasHojeResponse, entregasPendentesResponse, estatisticasResponse] = await Promise.all([
        entregaService.buscarEntregasHoje(),
        entregaService.buscarEntregasPendentes(),
        entregaService.obterEstatisticas(30)
      ]);

      if (entregasHojeResponse.success) {
        setEntregasHoje(entregasHojeResponse.data);
      }

      if (entregasPendentesResponse.success) {
        setEntregasPendentes(entregasPendentesResponse.data);
      }

      if (estatisticasResponse.success) {
        setEstatisticasEntrega(estatisticasResponse.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de entregas:', error);
      toast.error('Erro ao carregar dados de entregas');
    }
  };

  const carregarAgendamentos = async () => {
    try {
      setLoading(true);
      const response = await agendamentoService.listar();
      
      if (response.success) {
        // O backend já filtra os agendamentos por CD para usuários institution
        // Não precisa filtrar novamente no frontend
        setAgendamentos(response.data);
        console.log(`📦 Agendamentos carregados para ${userCD}:`, response.data.length);
      }
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('username');
    navigate('/');
  };

  const handleVerDetalhes = (agendamento: Agendamento) => {
    setAgendamentoSelecionado(agendamento);
    setModalDetalhesAberto(true);
  };

  const abrirNotaFiscal = (arquivo: string) => {
    const url = `http://localhost:3001${arquivo}`;
    window.open(url, '_blank');
  };

  const enviarEmailConfirmacao = (agendamento: Agendamento) => {
    // Mapear localizações dos CDs
    const localizacoes = {
      'Lagoa Nova': 'https://maps.app.goo.gl/5GdXDmPgmd8ijPd6A',
      'Pernambuco': 'https://maps.app.goo.gl/qDCpduM2VScnKToD6', 
      'Bahia': 'https://maps.app.goo.gl/WkTXcUywt6vimDY38'
    };

    const localizacao = localizacoes[agendamento.centro_distribuicao as keyof typeof localizacoes] || '';

    const to = agendamento.email;
    const subject = encodeURIComponent(`✅ Agendamento Confirmado - Brisa Agenda`);
    const body = encodeURIComponent(`Prezado(a),

Seu agendamento foi CONFIRMADO com sucesso!

📋 DADOS DO AGENDAMENTO:
• Empresa: ${agendamento.empresa}
• Nota Fiscal: ${agendamento.nota_fiscal}
• Número do Pedido: ${agendamento.numero_pedido}
• Centro de Distribuição: ${agendamento.centro_distribuicao}
• Data de Entrega: ${format(new Date(agendamento.data_entrega), "dd/MM/yyyy", { locale: ptBR })}
• Horário: ${formatarHorario(agendamento.horario_entrega)}
• Volumes/Paletes: ${agendamento.volumes_paletes || 'Não informado'}

📍 LOCALIZAÇÃO DO CD:
${agendamento.centro_distribuicao}: ${localizacao}

📞 CONTATO:
Em caso de dúvidas, entre em contato conosco.

✅ STATUS: CONFIRMADO
Confirmado por: ${userName} - ${userCD}

Atenciosamente,
Equipe Brisa Agenda`);

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');
  };

  const enviarEmailReagendamento = (agendamento: Agendamento, novaData: Date, novoHorario: string, motivo: string) => {
    // Mapear localizações dos CDs
    const localizacoes = {
      'Lagoa Nova': 'https://maps.app.goo.gl/5GdXDmPgmd8ijPd6A',
      'Pernambuco': 'https://maps.app.goo.gl/qDCpduM2VScnKToD6', 
      'Bahia': 'https://maps.app.goo.gl/WkTXcUywt6vimDY38'
    };

    const localizacao = localizacoes[agendamento.centro_distribuicao as keyof typeof localizacoes] || '';

    const to = agendamento.email;
    const subject = encodeURIComponent(`📅 Sugestão de Reagendamento - Brisa Agenda`);
    const body = encodeURIComponent(`Prezado(a),

Precisamos sugerir uma nova data para seu agendamento.

📋 AGENDAMENTO ORIGINAL:
• Empresa: ${agendamento.empresa}
• Nota Fiscal: ${agendamento.nota_fiscal}
• Data Solicitada: ${format(new Date(agendamento.data_entrega), "dd/MM/yyyy", { locale: ptBR })}
• Horário Solicitado: ${formatarHorario(agendamento.horario_entrega)}

📅 NOVA DATA SUGERIDA:
• Data: ${format(novaData, "dd/MM/yyyy", { locale: ptBR })}
• Horário: ${novoHorario}

💬 MOTIVO:
${motivo}

📞 PRÓXIMOS PASSOS:
Por favor, confirme se a nova data é adequada respondendo este email ou entre em contato conosco.

📍 LOCALIZAÇÃO DO CD:
${agendamento.centro_distribuicao}: ${localizacao}
Sugerido por: ${userName} - ${userCD}

Atenciosamente,
Equipe Brisa Agenda`);

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');
  };

  const aprovarAgendamento = async (agendamento: Agendamento) => {
    try {
      setProcessandoAcao(true);
      
      // Atualizar status no backend
      const response = await agendamentoService.atualizarStatus(
        agendamento.id, 
        'confirmado',
        observacoesAprovacao
      );

      if (response.success) {
        toast.success('✅ Agendamento aprovado! Agora ENVIE o email de confirmação.');
        
        // Recarregar lista
        await carregarAgendamentos();
        
        // Configurar para aguardar envio de email
        setAguardandoEmail(true);
        setTipoEmailPendente('confirmacao');
        setObservacoesAprovacao('');
      }
    } catch (error) {
      console.error('Erro ao aprovar agendamento:', error);
      toast.error('Erro ao aprovar agendamento');
    } finally {
      setProcessandoAcao(false);
    }
  };

  const confirmarEnvioEmailConfirmacao = (agendamento: Agendamento) => {
    // Enviar email de confirmação
    enviarEmailConfirmacao(agendamento);
    
    // Finalizar processo
    toast.success('📧 Email de confirmação enviado com sucesso!');
    setAguardandoEmail(false);
    setTipoEmailPendente(null);
    setModalDetalhesAberto(false);
  };

  const confirmarEnvioEmailReagendamento = (agendamento: Agendamento) => {
    if (!dadosReagendamento) return;
    
    // Enviar email de reagendamento
    enviarEmailReagendamento(
      agendamento, 
      dadosReagendamento.novaData, 
      dadosReagendamento.novoHorario, 
      dadosReagendamento.motivo
    );
    
    // Finalizar processo
    toast.success('📧 Email de sugestão de reagendamento enviado com sucesso!');
    setAguardandoEmail(false);
    setTipoEmailPendente(null);
    setDadosReagendamento(null);
    setModalDetalhesAberto(false);
  };

  const sugerirReagendamento = async () => {
    if (!agendamentoSelecionado || !novaDataSugerida || !novoHorarioSugerido) {
      toast.error('Preencha todos os campos do reagendamento');
      return;
    }

    try {
      setProcessandoAcao(true);
      
      const observacoes = `Nova data sugerida: ${format(novaDataSugerida, "dd/MM/yyyy", { locale: ptBR })} às ${novoHorarioSugerido}. Motivo: ${motivoReagendamento}`;
      
      const response = await agendamentoService.atualizarStatus(
        agendamentoSelecionado.id, 
        'sugestao_enviada',
        observacoes
      );

      if (response.success) {
        toast.success('📅 Reagendamento processado! Agora ENVIE o email de sugestão.');
        
        // Recarregar lista
        await carregarAgendamentos();
        
        // Salvar dados do reagendamento e configurar para aguardar email
        setDadosReagendamento({
          novaData: novaDataSugerida,
          novoHorario: novoHorarioSugerido,
          motivo: motivoReagendamento
        });
        setAguardandoEmail(true);
        setTipoEmailPendente('reagendamento');
        setModalReagendamentoAberto(false);
        
        // Limpar campos do modal
        setNovaDataSugerida(undefined);
        setNovoHorarioSugerido('');
        setMotivoReagendamento('');
      }
    } catch (error) {
      console.error('Erro ao sugerir reagendamento:', error);
      toast.error('Erro ao sugerir reagendamento');
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Funções para confirmar entregas
  const confirmarEntregaRapida = async (entrega: Agendamento, statusEntrega: string) => {
    try {
      setProcessandoEntrega(true);
      
      const response = await entregaService.confirmarEntrega(entrega.id, statusEntrega);
      
      if (response.success) {
        toast.success(`✅ ${response.message}`);
        // Recarregar dados
        await carregarDadosEntregas();
        await carregarAgendamentos();
      }
    } catch (error) {
      console.error('Erro ao confirmar entrega:', error);
      toast.error('Erro ao confirmar entrega');
    } finally {
      setProcessandoEntrega(false);
    }
  };

  const abrirModalConfirmarEntrega = (entrega: Agendamento) => {
    setEntregaSelecionada(entrega);
    setObservacoesEntrega('');
    setModalConfirmarEntrega(true);
  };

  // Funções para abrir modais detalhados
  const abrirModalEntregueDetalhes = (agendamento: Agendamento) => {
    setEntregaSelecionada(agendamento);
    limparCamposDetalhados();
    setModalEntregueDetalhes(true);
  };

  const abrirModalNaoVeioDetalhes = (agendamento: Agendamento) => {
    setEntregaSelecionada(agendamento);
    limparCamposDetalhados();
    setModalNaoVeioDetalhes(true);
  };

  const limparCamposDetalhados = () => {
    setEntregueNoHorario(null);
    setTransportadorInformou(null);
    setObservacoesDetalhadas('');
    setHorarioChegada('');
  };

  const confirmarEntregaComObservacoes = async (statusEntrega: string) => {
    if (!entregaSelecionada) return;

    try {
      setProcessandoEntrega(true);
      
      const response = await entregaService.confirmarEntrega(
        entregaSelecionada.id, 
        statusEntrega, 
        observacoesEntrega
      );
      
      if (response.success) {
        toast.success(`✅ ${response.message}`);
        setModalConfirmarEntrega(false);
        setEntregaSelecionada(null);
        setObservacoesEntrega('');
        // Recarregar dados
        await carregarDadosEntregas();
        await carregarAgendamentos();
      }
    } catch (error) {
      console.error('Erro ao confirmar entrega:', error);
      toast.error('Erro ao confirmar entrega');
    } finally {
      setProcessandoEntrega(false);
    }
  };

  // Confirmar entrega com dados detalhados
  const confirmarEntregaDetalhada = async (statusEntrega: string) => {
    if (!entregaSelecionada) return;

    try {
      setProcessandoEntrega(true);

      const dados = {
        status_entrega: statusEntrega,
        observacoes_entrega: null, // Campo separado para observações gerais
        entregue_no_horario: entregueNoHorario,
        transportador_informou: transportadorInformou,
        observacoes_detalhadas: observacoesDetalhadas,
        horario_chegada: horarioChegada
      };

      const response = await entregaService.confirmarEntregaDetalhada(entregaSelecionada.id, dados);

      if (response.success) {
        toast.success(`✅ ${response.message}`);
        
        // Fechar modais e limpar estados
        setModalEntregueDetalhes(false);
        setModalNaoVeioDetalhes(false);
        setEntregaSelecionada(null);
        limparCamposDetalhados();
        
        // Recarregar dados
        await carregarDadosEntregas();
        await carregarAgendamentos();
      }
    } catch (error) {
      console.error('Erro ao confirmar entrega detalhada:', error);
      toast.error('Erro ao confirmar entrega');
    } finally {
      setProcessandoEntrega(false);
    }
  };

  const formatarStatusEntrega = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'compareceu': 'Compareceu',
      'nao_compareceu': 'Não Compareceu',
      'compareceu_com_atraso': 'Compareceu com Atraso'
    };
    return statusMap[status] || 'Pendente';
  };

  const getStatusEntregaColor = (status: string): string => {
    const colorMap: { [key: string]: string } = {
      'compareceu': 'bg-green-100 text-green-800 border-green-200',
      'nao_compareceu': 'bg-red-100 text-red-800 border-red-200',
      'compareceu_com_atraso': 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Estatísticas rápidas
  const estatisticas = {
    pendentes: agendamentos.filter(ag => ag.status === 'pendente_confirmacao').length,
    confirmados: agendamentos.filter(ag => ag.status === 'confirmado').length,
    total: agendamentos.length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Logo Estilizado */}
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-3 border border-white border-opacity-30">
                <h1 className="text-lg font-bold text-white flex items-center">
                  <span className="bg-white text-orange-600 px-2 py-1 rounded-lg mr-2 text-sm font-black">
                    BRISA
                  </span>
                  <span className="font-light">Agenda</span>
                </h1>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">📦 Centro de Distribuição {userCD}</h1>
                <p className="text-orange-100">Bem-vindo, {userName} - Gerenciar Agendamentos</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-white hover:bg-white hover:bg-opacity-20 border-2 border-white border-opacity-30 backdrop-blur-sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair do Sistema
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Estatísticas */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-2 border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">{estatisticas.pendentes}</div>
                  <p className="text-yellow-700">Aguardando Confirmação</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{estatisticas.confirmados}</div>
                  <p className="text-green-700">Confirmados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">{estatisticas.total}</div>
                  <p className="text-orange-700">Total de Agendamentos</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seção de Entregas de Hoje */}
          {entregasHoje.length > 0 && (
            <Card className="shadow-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardHeader>
                <CardTitle className="text-blue-700 flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  📦 Entregas Agendadas para Hoje
                </CardTitle>
                <p className="text-sm text-blue-600">
                  Confirme se os transportadores compareceram nas entregas de hoje.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {entregasHoje.map((entrega) => (
                    <div key={entrega.id} className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-lg font-mono text-sm">
                              {formatarHorario(entrega.horario_entrega)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{entrega.empresa}</p>
                              <p className="text-sm text-gray-600">NF: {entrega.nota_fiscal}</p>
                            </div>
                          </div>
                          {entrega.status_entrega && (
                            <div className="mt-2">
                              <Badge className={getStatusEntregaColor(entrega.status_entrega)}>
                                {formatarStatusEntrega(entrega.status_entrega)}
                              </Badge>
                              {entrega.confirmado_entrega_por && (
                                <span className="text-xs text-gray-500 ml-2">
                                  por {entrega.confirmado_entrega_por}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {!entrega.status_entrega && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => confirmarEntregaRapida(entrega, 'compareceu')}
                              disabled={processandoEntrega}
                              className="bg-green-500 hover:bg-green-600 text-white"
                              size="sm"
                            >
                              ENTREGUE
                            </Button>
                            <Button
                              onClick={() => confirmarEntregaRapida(entrega, 'nao_compareceu')}
                              disabled={processandoEntrega}
                              variant="destructive"
                              size="sm"
                            >
                              NÃO VEIO
                            </Button>
                            <Button
                              onClick={() => abrirModalConfirmarEntrega(entrega)}
                              disabled={processandoEntrega}
                              variant="outline"
                              size="sm"
                              className="border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                            >
                              📝 Com Observação
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Estatísticas de Entregas */}
          {estatisticasEntrega && (
            <Card className="shadow-xl border-2 border-emerald-200">
              <CardHeader>
                <CardTitle className="text-emerald-700 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  📊 Estatísticas de Entregas (Últimos 30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">{estatisticasEntrega.taxa_comparecimento}%</div>
                      <p className="text-sm text-emerald-700">Taxa de Comparecimento</p>
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{estatisticasEntrega.compareceram}</div>
                      <p className="text-sm text-green-700">Compareceram</p>
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{estatisticasEntrega.nao_compareceram}</div>
                      <p className="text-sm text-red-700">Não Compareceram</p>
                    </div>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">{estatisticasEntrega.pendentes_confirmacao}</div>
                      <p className="text-sm text-amber-700">Pendentes</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de Agendamentos */}
          <Card className="shadow-xl border-2 border-orange-200">
            <CardHeader>
              <CardTitle className="text-orange-600">
                📋 Agendamentos - {userCD} ({agendamentos.length})
              </CardTitle>
              <p className="text-sm text-gray-600">
                Gerencie os agendamentos do seu Centro de Distribuição
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Carregando agendamentos...</p>
                </div>
              ) : agendamentos.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">Nenhum agendamento encontrado para {userCD}.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-orange-50">
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Empresa</th>
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Nota Fiscal</th>
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Data/Horário</th>
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Status</th>
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Material foi recebido?</th>
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agendamentos.map((agendamento) => (
                        <tr key={agendamento.id} className="hover:bg-orange-25">
                          <td className="border border-gray-200 px-4 py-2">{agendamento.empresa}</td>
                          <td className="border border-gray-200 px-4 py-2 font-mono text-sm">{agendamento.nota_fiscal}</td>
                          <td className="border border-gray-200 px-4 py-2">
                            {format(new Date(agendamento.data_entrega), "dd/MM/yyyy", { locale: ptBR })} às {formatarHorario(agendamento.horario_entrega)}
                          </td>
                                                    <td className="border border-gray-200 px-4 py-2">
                            <Badge className={`${getStatusColor(agendamento.status)}`}>
                              {formatarStatus(agendamento.status)}
                            </Badge>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            {agendamento.status_entrega ? (
                              <Badge className={`${getStatusEntregaColor(agendamento.status_entrega)}`}>
                                {formatarStatusEntrega(agendamento.status_entrega)}
                              </Badge>
                            ) : agendamento.status === 'confirmado' ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={() => abrirModalEntregueDetalhes(agendamento)}
                                  disabled={processandoEntrega}
                                  className="bg-green-500 hover:bg-green-600 text-white border-0 shadow-md transform hover:scale-105 transition-all text-xs"
                                  size="sm"
                                  title="Confirmar que o material foi entregue com detalhes"
                                >
                                  ENTREGUE
                                </Button>
                                <Button
                                  onClick={() => abrirModalNaoVeioDetalhes(agendamento)}
                                  disabled={processandoEntrega}
                                  variant="destructive"
                                  size="sm"
                                  className="shadow-md transform hover:scale-105 transition-all text-xs"
                                  title="Confirmar que o transportador não veio com detalhes"
                                >
                                  NÃO VEIO
                                </Button>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVerDetalhes(agendamento)}
                              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 shadow-md transform hover:scale-105 transition-all"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Gerenciar
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
        </div>
      </main>

      {/* Modal de Detalhes e Gerenciamento */}
      {modalDetalhesAberto && agendamentoSelecionado && (
        <Dialog open={modalDetalhesAberto} onOpenChange={setModalDetalhesAberto}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-orange-600">
                🔧 Gerenciar Agendamento - {agendamentoSelecionado.empresa}
              </DialogTitle>
              <DialogDescription>
                Visualize todos os detalhes e gerencie o status do agendamento.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Informações do Agendamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-gray-800">📋 Dados do Agendamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Informações de Contato */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-bold text-blue-800 mb-3">👤 Dados de Contato</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="font-semibold text-gray-700">Empresa:</Label>
                        <p className="text-gray-900 font-medium">{agendamentoSelecionado.empresa}</p>
                      </div>
                      <div>
                        <Label className="font-semibold text-gray-700">Email:</Label>
                        <p className="text-gray-900">{agendamentoSelecionado.email}</p>
                      </div>
                      <div>
                        <Label className="font-semibold text-gray-700">Telefone:</Label>
                        <p className="text-gray-900">{agendamentoSelecionado.telefone}</p>
                      </div>
                      <div>
                        <Label className="font-semibold text-gray-700">Centro de Distribuição:</Label>
                        <p className="text-gray-900 font-medium">{agendamentoSelecionado.centro_distribuicao}</p>
                      </div>
                    </div>
                  </div>

                  {/* Informações da Nota Fiscal */}
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-bold text-green-800 mb-3">📄 Dados da Nota Fiscal</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="font-semibold text-gray-700">Número da Nota Fiscal:</Label>
                        <p className="text-gray-900 font-mono text-lg">{agendamentoSelecionado.nota_fiscal}</p>
                      </div>
                      <div>
                        <Label className="font-semibold text-gray-700">Número do Pedido:</Label>
                        <p className="text-gray-900 font-mono text-lg">{agendamentoSelecionado.numero_pedido || 'Não informado'}</p>
                      </div>
                      <div>
                        <Label className="font-semibold text-gray-700">Valor da Nota Fiscal:</Label>
                        <p className="text-gray-900 font-bold text-green-700 text-lg">
                          R$ {agendamentoSelecionado.valor_nota_fiscal && !isNaN(Number(agendamentoSelecionado.valor_nota_fiscal)) ? 
                            Number(agendamentoSelecionado.valor_nota_fiscal).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }) : 'Não informado'}
                        </p>
                      </div>
                      <div>
                        <Label className="font-semibold text-gray-700">Volumes/Paletes:</Label>
                        <p className="text-gray-900 font-medium">{agendamentoSelecionado.volumes_paletes || 'Não informado'}</p>
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
                          {format(new Date(agendamentoSelecionado.data_entrega), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div>
                        <Label className="font-semibold text-gray-700">Horário Solicitado:</Label>
                        <p className="text-gray-900 font-bold text-lg">{formatarHorario(agendamentoSelecionado.horario_entrega)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Data de Criação */}
                  {(agendamentoSelecionado.created_at || agendamentoSelecionado.data_solicitacao) && (
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="text-center">
                        <Label className="font-semibold text-gray-600">📅 Solicitação Criada em:</Label>
                        <p className="text-gray-800 font-medium">
                          {format(new Date(agendamentoSelecionado.created_at || agendamentoSelecionado.data_solicitacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Status e Observações */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-gray-800">📊 Status e Observações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-semibold text-gray-700">Status Atual:</Label>
                      <Badge className={`${getStatusColor(agendamentoSelecionado.status)} ml-2`}>
                        {formatarStatus(agendamentoSelecionado.status)}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Observações do CD (se existirem) */}
                  {agendamentoSelecionado.observacoes && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <Label className="font-semibold text-blue-800">💬 Observações do Centro de Distribuição:</Label>
                      <p className="text-blue-900 mt-1 italic">"{agendamentoSelecionado.observacoes}"</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ações de Gerenciamento */}
              {agendamentoSelecionado.status === 'pendente_confirmacao' && !aguardandoEmail && (
                <Card className="border-2 border-yellow-200 bg-yellow-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-yellow-800">⚡ Escolha uma Ação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Observações para Aprovação */}
                    <div>
                      <Label htmlFor="observacoes">Observações (opcional):</Label>
                      <Textarea
                        id="observacoes"
                        placeholder="Adicione observações sobre a decisão..."
                        value={observacoesAprovacao}
                        onChange={(e) => setObservacoesAprovacao(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={() => aprovarAgendamento(agendamentoSelecionado)}
                        disabled={processandoAcao}
                        className="bg-green-600 hover:bg-green-700 text-white flex-1"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {processandoAcao ? 'Aprovando...' : 'Aceitar Data/Horário'}
                      </Button>

                      <Button
                        onClick={() => setModalReagendamentoAberto(true)}
                        disabled={processandoAcao}
                        className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        Sugerir Nova Data
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Card de Envio Obrigatório de Email */}
              {aguardandoEmail && (
                <Card className="border-2 border-orange-500 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-orange-800">
                      📧 ENVIO DE EMAIL OBRIGATÓRIO
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {tipoEmailPendente === 'confirmacao' && (
                      <div className="text-center space-y-3">
                        <div className="p-4 bg-green-100 rounded-lg border border-green-300">
                          <h4 className="font-bold text-green-800 mb-2">✅ Agendamento Aprovado!</h4>
                          <p className="text-green-700 text-sm">
                            Agora você DEVE enviar o email de confirmação para o cliente.
                          </p>
                        </div>
                        <Button
                          onClick={() => confirmarEnvioEmailConfirmacao(agendamentoSelecionado)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-bold"
                        >
                          <Mail className="w-5 h-5 mr-2" />
                          ENVIAR EMAIL DE CONFIRMAÇÃO
                        </Button>
                      </div>
                    )}

                    {tipoEmailPendente === 'reagendamento' && dadosReagendamento && (
                      <div className="text-center space-y-3">
                        <div className="p-4 bg-blue-100 rounded-lg border border-blue-300">
                          <h4 className="font-bold text-blue-800 mb-2">📅 Nova Data Sugerida!</h4>
                          <p className="text-blue-700 text-sm mb-2">
                            <strong>Nova Data:</strong> {format(dadosReagendamento.novaData, "dd/MM/yyyy", { locale: ptBR })} às {dadosReagendamento.novoHorario}
                          </p>
                          <p className="text-blue-700 text-sm">
                            Agora você DEVE enviar o email de sugestão para o cliente.
                          </p>
                        </div>
                        <Button
                          onClick={() => confirmarEnvioEmailReagendamento(agendamentoSelecionado)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-bold"
                        >
                          <Mail className="w-5 h-5 mr-2" />
                          ENVIAR EMAIL DE REAGENDAMENTO
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Nota Fiscal */}
              {agendamentoSelecionado.arquivo_nota_fiscal && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-gray-800">📄 Nota Fiscal</CardTitle>
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
                        onClick={() => abrirNotaFiscal(agendamentoSelecionado.arquivo_nota_fiscal!)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Reagendamento */}
      <Dialog open={modalReagendamentoAberto} onOpenChange={setModalReagendamentoAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-blue-600">📅 Sugerir Nova Data</DialogTitle>
            <DialogDescription>
              Proponha uma nova data e horário para o agendamento.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Nova Data Sugerida:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !novaDataSugerida && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {novaDataSugerida ? (
                      format(novaDataSugerida, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Escolha uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={novaDataSugerida}
                    onSelect={setNovaDataSugerida}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Novo Horário Sugerido:</Label>
              <select
                value={novoHorarioSugerido}
                onChange={(e) => setNovoHorarioSugerido(e.target.value)}
                className="w-full p-2 border rounded-md mt-1"
              >
                <option value="">Selecione um horário</option>
                {horariosDisponiveis.map((horario) => (
                  <option key={horario} value={horario}>
                    {horario}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Motivo do Reagendamento:</Label>
              <Textarea
                placeholder="Explique o motivo da necessidade de reagendar..."
                value={motivoReagendamento}
                onChange={(e) => setMotivoReagendamento(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setModalReagendamentoAberto(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={sugerirReagendamento}
                disabled={processandoAcao || !novaDataSugerida || !novoHorarioSugerido}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Mail className="w-4 h-4 mr-2" />
                {processandoAcao ? 'Enviando...' : 'Enviar Sugestão'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Confirmar Entrega com Observações */}
      <Dialog open={modalConfirmarEntrega} onOpenChange={setModalConfirmarEntrega}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-600">📦 Confirmar Status da Entrega</DialogTitle>
            <DialogDescription>
              Selecione o status da entrega e adicione observações se necessário.
            </DialogDescription>
          </DialogHeader>
          {entregaSelecionada && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="font-semibold text-blue-800">{entregaSelecionada.empresa}</p>
                <p className="text-sm text-blue-600">
                  NF: {entregaSelecionada.nota_fiscal} | {formatarHorario(entregaSelecionada.horario_entrega)}
                </p>
              </div>

              <div>
                <Label>Observações (opcional):</Label>
                <Textarea
                  placeholder="Ex: Chegou 15 minutos atrasado, problemas no trânsito..."
                  value={observacoesEntrega}
                  onChange={(e) => setObservacoesEntrega(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Button
                  onClick={() => confirmarEntregaComObservacoes('compareceu')}
                  disabled={processandoEntrega}
                  className="bg-green-500 hover:bg-green-600 text-white h-12"
                >
                  ENTREGUE
                </Button>
                <Button
                  onClick={() => confirmarEntregaComObservacoes('compareceu_com_atraso')}
                  disabled={processandoEntrega}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white h-12"
                >
                  ENTREGUE COM ATRASO
                </Button>
                <Button
                  onClick={() => confirmarEntregaComObservacoes('nao_compareceu')}
                  disabled={processandoEntrega}
                  variant="destructive"
                  className="h-12"
                >
                  NÃO VEIO
                </Button>
              </div>

              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setModalConfirmarEntrega(false);
                    setEntregaSelecionada(null);
                    setObservacoesEntrega('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Detalhado: ENTREGUE */}
      <Dialog open={modalEntregueDetalhes} onOpenChange={setModalEntregueDetalhes}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-green-600">✅ Confirmar Material Entregue</DialogTitle>
            <DialogDescription>
              Confirme os detalhes da entrega para enriquecer os relatórios.
            </DialogDescription>
          </DialogHeader>
          {entregaSelecionada && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="font-semibold text-green-800">{entregaSelecionada.empresa}</p>
                <p className="text-sm text-green-600">
                  NF: {entregaSelecionada.nota_fiscal} | Agendado: {formatarHorario(entregaSelecionada.horario_entrega)}
                </p>
              </div>

              <div>
                <Label className="font-semibold">Foi entregue no horário agendado?</Label>
                <Select value={entregueNoHorario === null ? '' : entregueNoHorario.toString()} onValueChange={(value) => setEntregueNoHorario(value === 'true')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">✅ Sim, no horário agendado</SelectItem>
                    <SelectItem value="false">⏰ Não, chegou em horário diferente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {entregueNoHorario === false && (
                <div>
                  <Label className="font-semibold">Que horas chegou?</Label>
                  <Input
                    type="time"
                    value={horarioChegada}
                    onChange={(e) => setHorarioChegada(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label className="font-semibold">Observações (opcional):</Label>
                <Textarea
                  placeholder="Ex: Chegou 15 min atrasado devido ao trânsito, material em perfeito estado..."
                  value={observacoesDetalhadas}
                  onChange={(e) => setObservacoesDetalhadas(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => confirmarEntregaDetalhada('compareceu')}
                  disabled={processandoEntrega || entregueNoHorario === null}
                  className="bg-green-500 hover:bg-green-600 text-white flex-1"
                >
                  {processandoEntrega ? 'Confirmando...' : 'CONFIRMAR ENTREGA'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setModalEntregueDetalhes(false);
                    limparCamposDetalhados();
                  }}
                  disabled={processandoEntrega}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Detalhado: NÃO VEIO */}
      <Dialog open={modalNaoVeioDetalhes} onOpenChange={setModalNaoVeioDetalhes}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-600">❌ Transportador Não Compareceu</DialogTitle>
            <DialogDescription>
              Registre os detalhes sobre a ausência do transportador.
            </DialogDescription>
          </DialogHeader>
          {entregaSelecionada && (
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="font-semibold text-red-800">{entregaSelecionada.empresa}</p>
                <p className="text-sm text-red-600">
                  NF: {entregaSelecionada.nota_fiscal} | Agendado: {formatarHorario(entregaSelecionada.horario_entrega)}
                </p>
              </div>

              <div>
                <Label className="font-semibold">O transportador informou previamente que não viria?</Label>
                <Select value={transportadorInformou === null ? '' : transportadorInformou.toString()} onValueChange={(value) => setTransportadorInformou(value === 'true')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">✅ Sim, avisou previamente</SelectItem>
                    <SelectItem value="false">❌ Não, simplesmente não apareceu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-semibold">Observações:</Label>
                <Textarea
                  placeholder="Ex: Avisou 1h antes por problemas no caminhão, não deu satisfação, etc..."
                  value={observacoesDetalhadas}
                  onChange={(e) => setObservacoesDetalhadas(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => confirmarEntregaDetalhada('nao_compareceu')}
                  disabled={processandoEntrega || transportadorInformou === null}
                  variant="destructive"
                  className="flex-1"
                >
                  {processandoEntrega ? 'Confirmando...' : 'CONFIRMAR AUSÊNCIA'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setModalNaoVeioDetalhes(false);
                    limparCamposDetalhados();
                  }}
                  disabled={processandoEntrega}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardCD; 