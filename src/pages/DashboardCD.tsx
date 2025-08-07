import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { 
  Eye, LogOut, FileText, ExternalLink, Filter, X, Check, 
  AlertTriangle, CalendarIcon, Mail, Clock, BarChart3, Ban, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatarDataBrasileira, formatarDataHoraBrasileira } from '@/lib/dateUtils';
import { agendamentoService, entregaService, bloqueioService } from '@/services/api';
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
}

interface BloqueioForm {
  data: string;
  horarioInicio: string;
  horarioFim: string;
  motivo: string;
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

// Função para detectar se uma entrega está próxima (1 hora ou menos)
const isEntregaProxima = (entrega: Agendamento): boolean => {
  const agora = new Date();
  const dataAgendamento = new Date(entrega.data_entrega);
  const [hora, minuto] = entrega.horario_entrega.split(':');
  dataAgendamento.setHours(parseInt(hora), parseInt(minuto), 0, 0);
  
  const diferencaTempo = dataAgendamento.getTime() - agora.getTime();
  const umaHora = 60 * 60 * 1000; // 1 hora em millisegundos
  
  // Retorna true se falta 1 hora ou menos (e ainda não passou do horário)
  return diferencaTempo > 0 && diferencaTempo <= umaHora;
};

// Função para obter o tempo restante formatado
const getTempoRestante = (entrega: Agendamento): string => {
  const agora = new Date();
  const dataAgendamento = new Date(entrega.data_entrega);
  const [hora, minuto] = entrega.horario_entrega.split(':');
  dataAgendamento.setHours(parseInt(hora), parseInt(minuto), 0, 0);
  
  const diferencaTempo = dataAgendamento.getTime() - agora.getTime();
  
  if (diferencaTempo <= 0) return 'Horário passou';
  
  const minutos = Math.floor(diferencaTempo / (1000 * 60));
  
  if (minutos < 60) {
    return `${minutos} min`;
  }
  
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  
  if (minutosRestantes === 0) {
    return `${horas}h`;
  }
  
  return `${horas}h ${minutosRestantes}min`;
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

const HORARIOS_DISPONIVEIS = [
  '08:00', '09:00', '10:00', '11:00', '13:00', 
  '14:00', '15:00', '16:00', '17:00'
];

const DashboardCD = () => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [modalReagendamentoAberto, setModalReagendamentoAberto] = useState(false);
  const [novaDataSugerida, setNovaDataSugerida] = useState<Date>();
  const [novoHorarioSugerido, setNovoHorarioSugerido] = useState('');
  const [motivoReagendamento, setMotivoReagendamento] = useState('');
  const [observacoesAprovacao, setObservacoesAprovacao] = useState('');
  const [modalBloqueioAposAprovar, setModalBloqueioAposAprovar] = useState(false);
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
  const [entregasFaltaConfirmar, setEntregasFaltaConfirmar] = useState<Agendamento[]>([]);
  const [estatisticasEntrega, setEstatisticasEntrega] = useState<EstatisticasEntrega | null>(null);
  const [modalConfirmarEntrega, setModalConfirmarEntrega] = useState(false);
  const [entregaSelecionada, setEntregaSelecionada] = useState<Agendamento | null>(null);
  const [observacoesEntrega, setObservacoesEntrega] = useState('');
  const [processandoEntrega, setProcessandoEntrega] = useState(false);

  // Estados para modais detalhados
  const [modalEntregueDetalhes, setModalEntregueDetalhes] = useState(false);
  const [modalNaoVeioDetalhes, setModalNaoVeioDetalhes] = useState(false);
  const [observacaoEntrega, setObservacaoEntrega] = useState('');
  const [entregueNoHorario, setEntregueNoHorario] = useState<boolean | null>(null);
  const [transportadorInformou, setTransportadorInformou] = useState<boolean | null>(null);
  const [observacoesDetalhadas, setObservacoesDetalhadas] = useState('');
  const [horarioChegada, setHorarioChegada] = useState('');

  // Estados para filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroNotaFiscal, setFiltroNotaFiscal] = useState('');
  const [filtroNumeroPedido, setFiltroNumeroPedido] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  // Estados para gerenciamento de bloqueios
  const [bloqueiosExistentes, setBloqueiosExistentes] = useState<any[]>([]);
  const [loadingBloqueios, setLoadingBloqueios] = useState(false);
  const [modalBloqueioAberto, setModalBloqueioAberto] = useState(false);
  const [modalNovoBloqueio, setModalNovoBloqueio] = useState(false);
  const [processandoBloqueio, setProcessandoBloqueio] = useState(false);
  const [aguardandoBloqueio, setAguardandoBloqueio] = useState(false);
  const [bloqueioForm, setBloqueioForm] = useState<BloqueioForm>({
    data: format(new Date(), 'yyyy-MM-dd'),
    horarioInicio: '', 
    horarioFim: '', 
    motivo: ''
  });
  const [novoBloqueio, setNovoBloqueio] = useState<BloqueioForm>({
    data: format(new Date(), 'yyyy-MM-dd'),
    horarioInicio: '', 
    horarioFim: '', 
    motivo: ''
  });
  
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
    carregarBloqueios();
  }, []);

  // Carregar bloqueios existentes
  const carregarBloqueios = async () => {
    try {
      setLoadingBloqueios(true);
      console.log('🔄 Carregando bloqueios...');
      
      const response = await bloqueioService.listar();
      console.log('📋 Resposta da API de bloqueios:', response);
      
      if (response.success) {
        console.log('✅ Bloqueios carregados:', response.data?.length || 0);
        setBloqueiosExistentes(response.data || []);
      } else {
        console.error('❌ Erro na resposta da API:', response);
        setBloqueiosExistentes([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar bloqueios:', error);
      setBloqueiosExistentes([]);
    } finally {
      setLoadingBloqueios(false);
    }
  };

  // Carregar dados de entregas
  const carregarDadosEntregas = async () => {
    try {
      console.log('🔄 Carregando dados de entregas...');
      const [entregasHojeResponse, entregasPendentesResponse, estatisticasResponse] = await Promise.all([
        entregaService.buscarEntregasHoje(),
        entregaService.buscarEntregasPendentes(),
        entregaService.obterEstatisticas(30)
      ]);

      console.log('📥 Resposta da API entregas hoje:', entregasHojeResponse);

      if (entregasHojeResponse.success) {
        const entregasOriginais = entregasHojeResponse.data;
        console.log('📊 Dados originais recebidos da API:', entregasOriginais);

        // Verificar se há entregas de datas incorretas
        entregasOriginais.forEach(entrega => {
          console.log(`🔍 Entrega recebida: ${entrega.empresa} - Data: ${entrega.data_entrega} - Status: ${entrega.status_entrega || 'Não confirmado'}`);
        });

        // Filtrar apenas entregas realmente de HOJE e não confirmadas
        const agora = new Date();
        const hoje = agora.getFullYear() + '-' + 
                     String(agora.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(agora.getDate()).padStart(2, '0');
        
        console.log(`📅 Data de hoje calculada no frontend: ${hoje}`);
        
        // Separar primeiro as que já passaram muito do horário para a seção de "falta confirmar"
        // (mais de 4 horas após o horário agendado - QUALQUER data)
        const faltaConfirmar = entregasOriginais.filter(entrega => {
          // Já foi confirmada - não vai para "falta confirmar"
          if (entrega.status_entrega) return false;

          // Criar data/hora do agendamento
          const dataAgendamento = new Date(entrega.data_entrega);
          const [hora, minuto] = entrega.horario_entrega.split(':');
          dataAgendamento.setHours(parseInt(hora), parseInt(minuto), 0, 0);

          // Se passou mais de 4 horas do horário, vai para "falta confirmar" (aumentei de 2 para 4 horas)
          const quatroHoras = 4 * 60 * 60 * 1000; // 4 horas em millisegundos
          const tempoPassado = agora.getTime() - dataAgendamento.getTime();
          
          if (tempoPassado > quatroHoras) {
            console.log(`📋 Entrega em atraso: ${entrega.empresa} - Data: ${entrega.data_entrega} - Tempo passado: ${Math.floor(tempoPassado / (60 * 60 * 1000))}h`);
            return true;
          }
          
          return false;
        });

        // Filtrar entregas de hoje: só as que são realmente de hoje, não confirmadas 
        // E que não estão na seção "falta confirmar"
        const entregasHoje = entregasOriginais.filter(entrega => {
          console.log(`\n🔍 ANALISANDO ENTREGA: ${entrega.empresa} (ID: ${entrega.id})`);
          console.log(`   Data entrega: ${entrega.data_entrega}`);
          console.log(`   Data hoje: ${hoje}`);
          console.log(`   Horário: ${entrega.horario_entrega}`);
          console.log(`   Status entrega: ${entrega.status_entrega || 'Não confirmado'}`);
          
          // Verificar se é realmente de hoje
          if (entrega.data_entrega !== hoje) {
            console.log(`   ❌ REJEITADA: Data incorreta (${entrega.data_entrega} ≠ ${hoje})`);
            return false;
          }
          
          // Verificar se não foi confirmada
          if (entrega.status_entrega) {
            console.log(`   ❌ REJEITADA: Já confirmada (${entrega.status_entrega})`);
            return false;
          }

          // Verificar se não está na seção "falta confirmar"
          const estaEmFaltaConfirmar = faltaConfirmar.some(fc => fc.id === entrega.id);
          if (estaEmFaltaConfirmar) {
            console.log(`   ❌ REJEITADA: Está em "falta confirmar"`);
            return false;
          }
          
          console.log(`   ✅ ACEITA: Vai aparecer em "Entregas Agendadas para Hoje"`);
          return true; // Mostrar apenas entregas de hoje não confirmadas e não atrasadas
        });

        console.log(`📊 Entregas filtradas - Hoje: ${entregasHoje.length}, Falta confirmar: ${faltaConfirmar.length}`);
        setEntregasHoje(entregasHoje);
        setEntregasFaltaConfirmar(faltaConfirmar);
      }

      if (entregasPendentesResponse.success) {
        setEntregasPendentes(entregasPendentesResponse.data);
      }

      if (estatisticasResponse.success) {
        setEstatisticasEntrega(estatisticasResponse.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de entregas:', error);
      // Definir estados padrão em caso de erro
      setEntregasHoje([]);
      setEntregasPendentes([]);
      setEntregasFaltaConfirmar([]);
      setEstatisticasEntrega(null);
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

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltroEmpresa('');
    setFiltroNotaFiscal('');
    setFiltroNumeroPedido('');
    setFiltroStatus('');
    setPaginaAtual(1); // Volta para primeira página
  };

  // Função para filtrar agendamentos
  const agendamentosFiltrados = agendamentos.filter(agendamento => {
    const matchEmpresa = filtroEmpresa === '' || agendamento.empresa.toLowerCase().includes(filtroEmpresa.toLowerCase());
    const matchNotaFiscal = filtroNotaFiscal === '' || agendamento.nota_fiscal.includes(filtroNotaFiscal);
    const matchNumeroPedido = filtroNumeroPedido === '' || agendamento.numero_pedido?.includes(filtroNumeroPedido);
    const matchStatus = filtroStatus === '' || agendamento.status === filtroStatus;
    
    return matchEmpresa && matchNotaFiscal && matchNumeroPedido && matchStatus;
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
  }, [filtroEmpresa, filtroNotaFiscal, filtroNumeroPedido, filtroStatus]);

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
    const subject = encodeURIComponent(`✅ Agendamento Confirmado - Brisa Agenda - NF ${agendamento.nota_fiscal} no CD ${agendamento.centro_distribuicao}`);
    const body = encodeURIComponent(`Prezado(a),

Seu agendamento foi CONFIRMADO com sucesso!

📋 DADOS DO AGENDAMENTO:
• Empresa: ${agendamento.empresa}
• Nota Fiscal: ${agendamento.nota_fiscal}
• Número do Pedido: ${agendamento.numero_pedido}
• Centro de Distribuição: ${agendamento.centro_distribuicao}
• Data de Entrega: ${formatarDataBrasileira(agendamento.data_entrega)}
• Horário: ${formatarHorario(agendamento.horario_entrega)}
• Volumes/Paletes: ${agendamento.volumes_paletes || 'Não informado'}

📍 LOCALIZAÇÃO DO CD:
${agendamento.centro_distribuicao}: ${localizacao}

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
    const subject = encodeURIComponent(`📅 Solicitação de Reagendamento - Brisa Agenda - NF ${agendamento.nota_fiscal} no CD ${agendamento.centro_distribuicao}`);
    const body = encodeURIComponent(`Prezado(a),

Precisamos solicitar o reagendamento de sua entrega.

📋 AGENDAMENTO ORIGINAL:
• Empresa: ${agendamento.empresa}
• Nota Fiscal: ${agendamento.nota_fiscal}
• Número do Pedido: ${agendamento.numero_pedido}
• Centro de Distribuição: ${agendamento.centro_distribuicao}
• Data Solicitada: ${formatarDataBrasileira(agendamento.data_entrega)}
• Horário Solicitado: ${formatarHorario(agendamento.horario_entrega)}

📅 DATA SUGERIDA:
• Data: ${format(novaData, "dd/MM/yyyy", { locale: ptBR })}
• Horário: ${novoHorario}

💬 MOTIVO DO REAGENDAMENTO:
${motivo}

📞 PRÓXIMOS PASSOS:
Por favor, acesse nosso site e crie um novo agendamento com a data sugerida acima ou uma data posterior de sua preferência.

Link para novo agendamento: http://localhost:8080/agendamento

📋 STATUS: Aguardando novo agendamento
Solicitado por: ${userName} - ${userCD}

Atenciosamente,
Equipe Brisa Agenda`);

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');
  };

  const aprovarAgendamento = async (agendamento: Agendamento) => {
    try {
      // Primeiro perguntar sobre bloqueio, depois aprovar e enviar email
      setSelectedAgendamento(agendamento);
      setModalBloqueioAposAprovar(true);
    } catch (error) {
      console.error('Erro ao processar aprovação:', error);
      toast.error('Erro ao processar aprovação');
    }
  };

  const confirmarAprovacaoAgendamento = async (agendamento: Agendamento) => {
    try {
      setProcessandoAcao(true);
      
      // Atualizar status no backend
      const response = await agendamentoService.atualizarStatus(
        agendamento.id, 
        'confirmado',
        observacoesAprovacao
      );

      if (response.success) {
        toast.success('✅ Agendamento aprovado!');
        
        // Recarregar lista
        await carregarAgendamentos();
        
        // Ir para o envio de email obrigatório
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
    
    // Finalizar processo obrigatório
    setAguardandoEmail(false);
    setTipoEmailPendente(null);
    
    // Mostrar mensagem de sucesso
    toast.success('📧 Email de confirmação enviado com sucesso!');
  };

  const confirmarEnvioEmailReagendamento = (agendamento: Agendamento) => {
    // Como exemplo, vamos usar dados genéricos para reagendamento
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    
    // Enviar email de reagendamento
    enviarEmailReagendamento(
      agendamento, 
      amanha, 
      '08:00', 
      'Reagendamento solicitado'
    );
    
    // Finalizar processo obrigatório
    setAguardandoEmail(false);
    setTipoEmailPendente(null);
    
    // Mostrar mensagem de sucesso
    toast.success('📧 Email de reagendamento enviado com sucesso!');
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
        
        // Configurar para aguardar envio de email de reagendamento
        setAguardandoEmail(true);
        setTipoEmailPendente('reagendamento');
        
        // Fechar modal e limpar campos
        setModalReagendamentoAberto(false);
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
    setObservacaoEntrega('');
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
        observacoes_entrega: observacaoEntrega, // Campo obrigatório com informações principais
        entregue_no_horario: entregueNoHorario,
        transportador_informou: transportadorInformou,
        observacoes_detalhadas: observacoesDetalhadas, // Campo opcional com detalhes extras
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

  // Funções para gerenciamento de bloqueios
  const criarNovoBloqueio = async () => {
    if (!bloqueioForm.data || !bloqueioForm.horarioInicio || !bloqueioForm.horarioFim || !bloqueioForm.motivo) {
      toast.error('Preencha todos os campos do bloqueio');
      return;
    }

    try {
      setProcessandoBloqueio(true);
      console.log('🔒 Criando bloqueio:', bloqueioForm);

      const response = await bloqueioService.bloquear({
        data: bloqueioForm.data,
        horarioInicio: bloqueioForm.horarioInicio,
        horarioFim: bloqueioForm.horarioFim,
        motivo: bloqueioForm.motivo
      });

      console.log('🔒 Resposta da criação:', response);

      if (response.success) {
        toast.success('✅ Bloqueio criado com sucesso!');
        setBloqueioForm({ 
          data: format(new Date(), 'yyyy-MM-dd'),
          horarioInicio: '', 
          horarioFim: '', 
          motivo: ''
        });
        setModalNovoBloqueio(false);
        
        // Recarregar dados
        console.log('🔄 Recarregando bloqueios após criação...');
        await carregarBloqueios();
        await carregarAgendamentos();

        // Se há um agendamento selecionado, aprovar automaticamente após o bloqueio
        if (selectedAgendamento) {
          console.log('✅ Aprovando agendamento após bloqueio...');
          await confirmarAprovacaoAgendamento(selectedAgendamento);
        }
      } else {
        console.error('❌ Falha ao criar bloqueio:', response);
        toast.error(response.message || 'Erro ao criar bloqueio');
      }
    } catch (error) {
      console.error('❌ Erro ao criar bloqueio:', error);
      toast.error('Erro ao criar bloqueio');
    } finally {
      setProcessandoBloqueio(false);
    }
  };

  const removerBloqueio = async (bloqueioId: number) => {
    if (!confirm('Tem certeza que deseja remover este bloqueio?')) {
      return;
    }

    try {
      setProcessandoBloqueio(true);

      const response = await bloqueioService.remover(bloqueioId);

      if (response.success) {
        toast.success('✅ Bloqueio removido com sucesso!');
        
        // Recarregar dados
        await carregarBloqueios();
        await carregarAgendamentos();
      }
    } catch (error) {
      console.error('Erro ao remover bloqueio:', error);
      toast.error('Erro ao remover bloqueio');
    } finally {
      setProcessandoBloqueio(false);
    }
  };

  // Funções para bloqueio de horários
  const handleBloqueioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProcessandoAcao(true);

      // Validar campos
      if (!bloqueioForm.data || !bloqueioForm.horarioInicio || !bloqueioForm.horarioFim || !bloqueioForm.motivo) {
        toast.error('Preencha todos os campos do bloqueio');
        return;
      }

      // Validar horários
      const horaInicio = parseInt(bloqueioForm.horarioInicio.split(':')[0]);
      const horaFim = parseInt(bloqueioForm.horarioFim.split(':')[0]);
      
      if (horaInicio >= horaFim) {
        toast.error('O horário de fim deve ser maior que o horário de início');
        return;
      }

      const response = await bloqueioService.bloquear({
        data: bloqueioForm.data,
        horarioInicio: bloqueioForm.horarioInicio,
        horarioFim: bloqueioForm.horarioFim,
        motivo: bloqueioForm.motivo
      });

      if (response.success) {
        toast.success('✅ Horário bloqueado com sucesso!');
        setBloqueioForm({ 
          data: format(new Date(), 'yyyy-MM-dd'),
          horarioInicio: '', 
          horarioFim: '', 
          motivo: ''
        });
        setModalBloqueioAberto(false);
        await carregarAgendamentos();
        
        // Se estiver no fluxo de aprovação, continuar para o email
        if (aguardandoBloqueio) {
          setAguardandoBloqueio(false);
          setAguardandoEmail(true);
          setTipoEmailPendente('confirmacao');
        }
      }
    } catch (error) {
      console.error('Erro ao bloquear horário:', error);
      toast.error('Erro ao bloquear horário');
    } finally {
      setProcessandoAcao(false);
    }
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
            <div className="flex items-center gap-4">
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

          {/* Lista de Agendamentos com Filtros Integrados */}
          <Card className="shadow-xl border-2 border-orange-200">
            <CardHeader>
              <CardTitle className="text-orange-600">
                📋 Agendamentos - {userCD} 
                <span className="text-sm font-normal text-gray-600 ml-2">
                  (Página {paginaAtual} de {totalPaginas} - {agendamentosOrdenados.length} total)
                </span>
              </CardTitle>
              <p className="text-sm text-gray-600">
                Gerencie os agendamentos do seu Centro de Distribuição (pendentes aparecem primeiro)
              </p>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="h-5 w-5 text-orange-600" />
                  <h3 className="font-semibold text-orange-600">Filtros de Pesquisa</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                </div>
                <div className="mt-4 flex justify-end">
                  <Button 
                    variant="outline" 
                    onClick={limparFiltros} 
                    className="flex items-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    <X className="h-4 w-4" />
                    Limpar Filtros
                  </Button>
                </div>
              </div>

              {/* Tabela de Agendamentos */}
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
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Status Recebimento</th>
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agendamentosPaginados.map((agendamento) => (
                        <tr key={agendamento.id} className="hover:bg-orange-25">
                          <td className="border border-gray-200 px-4 py-2">{agendamento.empresa}</td>
                          <td className="border border-gray-200 px-4 py-2 font-mono text-sm">{agendamento.nota_fiscal}</td>
                          <td className="border border-gray-200 px-4 py-2">
                            {formatarDataBrasileira(agendamento.data_entrega)} às {formatarHorario(agendamento.horario_entrega)}
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
                            ) : (
                              <span className="text-gray-500 text-sm italic">
                                Aguardando confirmação na seção "Entregas Agendadas"
                              </span>
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

              {/* Paginação */}
              {totalPaginas > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Mostrando {indiceInicio + 1} a {Math.min(indiceFim, agendamentosOrdenados.length)} de {agendamentosOrdenados.length} agendamentos
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
            </CardContent>
          </Card>

          {/* Seção de Entregas de Hoje */}
          {entregasHoje.length > 0 && (
            <Card className="shadow-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardHeader>
                <CardTitle className="text-blue-700 flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  📦 Entregas Agendadas para Hoje
                </CardTitle>
                <p className="text-sm text-blue-600">
                  Monitoramento de entregas do dia - Alertas aparecem 1 hora antes do horário agendado.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {entregasHoje.map((entrega) => {
                    const isProxima = isEntregaProxima(entrega);
                    const tempoRestante = getTempoRestante(entrega);
                    
                    return (
                      <div 
                        key={entrega.id} 
                        className={cn(
                          "p-4 rounded-lg border shadow-sm",
                          isProxima 
                            ? "bg-gradient-to-r from-red-50 to-orange-50 border-red-300 border-2 shadow-lg" 
                            : "bg-white border-blue-200"
                        )}
                      >
                        {/* Alerta proeminente para entregas próximas */}
                        {isProxima && (
                          <div className="mb-4 p-3 bg-red-100 border-2 border-red-300 rounded-lg">
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="h-6 w-6 text-red-600 animate-pulse" />
                              <div className="flex-1">
                                <p className="font-bold text-red-800 text-lg">
                                  🚨 ALERTA: Entrega chega em {tempoRestante}!
                                </p>
                                <p className="text-red-700 text-sm">
                                  {entrega.empresa} - NF: {entrega.nota_fiscal}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "px-2 py-1 rounded-lg font-mono text-sm",
                                isProxima 
                                  ? "bg-red-100 text-red-800 border border-red-300" 
                                  : "bg-blue-100 text-blue-800"
                              )}>
                                {formatarHorario(entrega.horario_entrega)}
                                {isProxima && (
                                  <span className="ml-2 text-xs font-bold">
                                    ({tempoRestante})
                                  </span>
                                )}
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
                                onClick={() => abrirModalEntregueDetalhes(entrega)}
                                disabled={processandoEntrega}
                                className="bg-green-500 hover:bg-green-600 text-white"
                                size="sm"
                              >
                                ENTREGUE
                              </Button>
                              <Button
                                onClick={() => abrirModalNaoVeioDetalhes(entrega)}
                                disabled={processandoEntrega}
                                variant="destructive"
                                size="sm"
                              >
                                NÃO VEIO
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seção Falta Confirmar a Entrega */}
          {entregasFaltaConfirmar.length > 0 && (
            <Card className="shadow-xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-pink-50">
              <CardHeader>
                <CardTitle className="text-red-700 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  ⚠️ Entregas com Atraso Significativo ({entregasFaltaConfirmar.length})
                </CardTitle>
                <p className="text-sm text-red-600">
                  Entregas que passaram mais de 2 horas do horário agendado e ainda precisam ser confirmadas.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {entregasFaltaConfirmar.map((entrega) => (
                    <div key={entrega.id} className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div className="bg-red-100 text-red-800 px-2 py-1 rounded-lg font-mono text-sm">
                              {formatarHorario(entrega.horario_entrega)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{entrega.empresa}</p>
                              <p className="text-sm text-gray-600">NF: {entrega.nota_fiscal}</p>
                              <p className="text-xs text-red-600 font-semibold">
                                ⏰ Horário já passou - Confirme a entrega
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => abrirModalEntregueDetalhes(entrega)}
                            disabled={processandoEntrega}
                            className="bg-green-500 hover:bg-green-600 text-white"
                            size="sm"
                          >
                            ENTREGUE
                          </Button>
                          <Button
                            onClick={() => abrirModalNaoVeioDetalhes(entrega)}
                            disabled={processandoEntrega}
                            variant="destructive"
                            size="sm"
                          >
                            NÃO VEIO
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seção de Gerenciamento de Bloqueios */}
          <Card className="shadow-xl border-2 border-red-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-red-600 flex items-center">
                    <Ban className="h-5 w-5 mr-2" />
                    🚫 Gerenciar Bloqueios de Horários - {userCD}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Visualize, adicione e remova bloqueios de horários para seu CD
                  </p>
                </div>
                <Button
                  onClick={() => setModalNovoBloqueio(true)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Novo Bloqueio
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingBloqueios ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Carregando bloqueios...</p>
                </div>
              ) : bloqueiosExistentes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <p className="text-green-700 font-medium">✅ Nenhum bloqueio ativo encontrado</p>
                    <p className="text-sm text-green-600 mt-1">Todos os horários estão disponíveis para agendamento</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {bloqueiosExistentes.map((bloqueio) => (
                    <div key={bloqueio.id} className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-lg font-mono text-sm">
                              📅 {bloqueio.data_bloqueio ? formatarDataBrasileira(bloqueio.data_bloqueio) : 'Data não informada'}
                            </div>
                            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-lg font-mono text-sm">
                              🕐 {bloqueio.horario_inicio || 'N/A'} - {bloqueio.horario_fim || 'N/A'}
                            </div>
                          </div>
                          <div className="text-sm text-gray-700">
                            <p><strong>Motivo:</strong> {bloqueio.motivo}</p>
                            {bloqueio.criado_por && (
                              <p className="text-xs text-gray-500 mt-1">
                                Bloqueado por: {bloqueio.criado_por} {bloqueio.data_criacao ? `em ${formatarDataHoraBrasileira(bloqueio.data_criacao)}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => removerBloqueio(bloqueio.id)}
                          disabled={processandoBloqueio}
                          variant="destructive"
                          size="sm"
                          className="ml-4"
                        >
                          {processandoBloqueio ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
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
                          {formatarDataBrasileira(agendamentoSelecionado.data_entrega)}
                        </p>
                      </div>
                      <div>
                        <Label className="font-semibold text-gray-700">Horário Solicitado:</Label>
                        <p className="text-gray-900 font-bold text-lg">{formatarHorario(agendamentoSelecionado.horario_entrega)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Data de Criação */}
                  {agendamentoSelecionado.data_solicitacao && (
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="text-center">
                        <Label className="font-semibold text-gray-600">📅 Solicitação Criada em:</Label>
                        <p className="text-gray-800 font-medium">
                          {formatarDataHoraBrasileira(agendamentoSelecionado.data_solicitacao)}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Status e Controles */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-gray-800">📊 Status e Controles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Atual */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="font-semibold text-gray-700">Status do Agendamento</Label>
                        <Badge className={getStatusColor(agendamentoSelecionado.status)}>
                          {formatarStatus(agendamentoSelecionado.status)}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-right">
                        <Label className="font-semibold text-gray-700">Status da Entrega</Label>
                        <Badge className={getStatusEntregaColor(agendamentoSelecionado.status_entrega || '')}>
                          {formatarStatusEntrega(agendamentoSelecionado.status_entrega || '')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* Observações da Entrega */}
                  {(agendamentoSelecionado.observacoes_entrega || agendamentoSelecionado.observacoes_detalhadas) && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-bold text-blue-800 mb-3">📝 Informações da Entrega</h4>
                      
                      {agendamentoSelecionado.observacoes_entrega && (
                        <div className="mb-3">
                          <Label className="font-semibold text-blue-700">Observações principais:</Label>
                          <p className="text-blue-900 bg-white p-2 rounded border mt-1">
                            {agendamentoSelecionado.observacoes_entrega}
                          </p>
                        </div>
                      )}
                      
                      {agendamentoSelecionado.observacoes_detalhadas && (
                        <div className="mb-3">
                          <Label className="font-semibold text-blue-700">Detalhes adicionais:</Label>
                          <p className="text-blue-900 bg-white p-2 rounded border mt-1">
                            {agendamentoSelecionado.observacoes_detalhadas}
                          </p>
                        </div>
                      )}
                      
                      {agendamentoSelecionado.confirmado_entrega_por && (
                        <div className="text-xs text-blue-600 border-t border-blue-200 pt-2 mt-2">
                          <strong>Confirmado por:</strong> {agendamentoSelecionado.confirmado_entrega_por}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Ações de Gerenciamento */}
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <h4 className="font-bold text-orange-800 mb-3">⚡ Ações Disponíveis</h4>
                    
                    {/* Ações para Pendentes de Confirmação */}
                    {agendamentoSelecionado.status === 'pendente_confirmacao' && (
                      <div className="flex justify-center gap-2">
                        <Button
                          onClick={() => aprovarAgendamento(agendamentoSelecionado)}
                          className="bg-green-500 hover:bg-green-600 text-white"
                          disabled={processandoAcao}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          {processandoAcao ? 'Aprovando...' : 'Aprovar Agendamento'}
                        </Button>
                        <Button
                          onClick={() => setModalReagendamentoAberto(true)}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                          disabled={processandoAcao}
                        >
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          Sugerir Nova Data
                        </Button>
                      </div>
                    )}

                    {/* Ações para Confirmados - APENAS para reenvio */}
                    {agendamentoSelecionado.status === 'confirmado' && !aguardandoEmail && (
                      <div className="space-y-3">
                        <div className="p-3 bg-green-100 rounded-lg border border-green-300">
                          <h5 className="font-bold text-green-800 mb-2">✅ Email de Confirmação</h5>
                          <p className="text-green-700 text-sm mb-3">
                            Email de confirmação já foi enviado. Deseja enviar novamente?
                          </p>
                          <Button
                            onClick={() => confirmarEnvioEmailConfirmacao(agendamentoSelecionado)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Reenviar Email de Confirmação
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Ações para Sugestão Enviada - APENAS para reenvio */}
                    {agendamentoSelecionado.status === 'sugestao_enviada' && !aguardandoEmail && (
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-100 rounded-lg border border-blue-300">
                          <h5 className="font-bold text-blue-800 mb-2">📅 Email de Reagendamento</h5>
                          <p className="text-blue-700 text-sm mb-3">
                            Email de reagendamento já foi enviado. Deseja enviar novamente?
                          </p>
                          <Button
                            onClick={() => confirmarEnvioEmailReagendamento(agendamentoSelecionado)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Reenviar Email de Reagendamento
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Mensagem para outros casos */}
                    {agendamentoSelecionado.status === 'pendente_confirmacao' && (
                      <div className="text-center text-gray-600">
                        <p className="text-sm">Aprove ou sugira nova data para disponibilizar opções de email.</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Observações */}
                  {agendamentoSelecionado.observacoes && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-bold text-blue-800 mb-2">� Observações</h4>
                      <p className="text-blue-900">{agendamentoSelecionado.observacoes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card de Confirmação de Bloqueio - REMOVIDO: agora vai direto para email */}

              {/* Card de Envio Obrigatório de Email - PRIMEIRA VEZ */}
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

                    {tipoEmailPendente === 'reagendamento' && (
                      <div className="text-center space-y-3">
                        <div className="p-4 bg-blue-100 rounded-lg border border-blue-300">
                          <h4 className="font-bold text-blue-800 mb-2">📅 Nova Data Sugerida!</h4>
                          <p className="text-blue-700 text-sm">
                            Agora você DEVE enviar o email de reagendamento para o cliente.
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
                <Label className="font-semibold text-red-600">Observações sobre a entrega *</Label>
                <p className="text-xs text-gray-600 mb-2">
                  Campo obrigatório: descreva como foi o recebimento, condições do material, etc.
                </p>
                <Textarea
                  placeholder="Ex: Material chegou em perfeito estado, transportador pontual, sem avarias..."
                  value={observacaoEntrega}
                  onChange={(e) => setObservacaoEntrega(e.target.value)}
                  className="mt-1 border-red-200 focus:border-red-500"
                  rows={3}
                  required
                />
              </div>

              <div>
                <Label className="font-semibold">Observações adicionais (opcional):</Label>
                <Textarea
                  placeholder="Ex: Detalhes extras sobre o recebimento..."
                  value={observacoesDetalhadas}
                  onChange={(e) => setObservacoesDetalhadas(e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => confirmarEntregaDetalhada('compareceu')}
                  disabled={processandoEntrega || entregueNoHorario === null || !observacaoEntrega.trim()}
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

      {/* Modal de Bloqueio de Horários */}
      <Dialog open={modalBloqueioAberto} onOpenChange={setModalBloqueioAberto}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>🚫 Bloquear Horários</DialogTitle>
            <DialogDescription>
              Bloqueie um intervalo de horários para impedir novos agendamentos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleBloqueioSubmit} className="space-y-4">
            <div className="space-y-4">
              {/* Seletor de Data */}
              <div className="space-y-2">
                <Label>Data do Bloqueio</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-orange-200 hover:border-orange-300 focus:border-orange-500",
                        !bloqueioForm.data && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-orange-500" />
                      {bloqueioForm.data ? formatarDataBrasileira(bloqueioForm.data) : <span>Selecione uma data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-orange-200" align="start">
                    <Calendar
                      mode="single"
                      selected={bloqueioForm.data ? new Date(bloqueioForm.data + 'T00:00:00') : undefined}
                      onSelect={(date) => {
                        if (date) {
                          // Usar getFullYear, getMonth, getDate para evitar problemas de timezone
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const dateString = `${year}-${month}-${day}`;
                          setBloqueioForm(prev => ({
                            ...prev,
                            data: dateString
                          }));
                        } else {
                          setBloqueioForm(prev => ({
                            ...prev,
                            data: ''
                          }));
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      locale={ptBR}
                      className="rounded-lg border-orange-200"
                      classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center text-orange-700",
                        caption_label: "text-sm font-medium text-orange-700",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-orange-600 hover:bg-orange-50",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell: "text-orange-600 rounded-md w-8 font-normal text-[0.8rem]",
                        row: "flex w-full mt-2",
                        cell: cn(
                          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-orange-50 [&:has([aria-selected].day-outside)]:bg-orange-50/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
                          "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
                        ),
                        day: cn(
                          "h-8 w-8 p-0 font-normal aria-selected:opacity-100 hover:bg-orange-50 hover:text-orange-900",
                          "focus:bg-orange-100 focus:text-orange-900"
                        ),
                        day_range_end: "day-range-end",
                        day_selected: "bg-orange-500 text-white hover:bg-orange-600 hover:text-white focus:bg-orange-600 focus:text-white",
                        day_today: "bg-orange-100 text-orange-900 font-semibold",
                        day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-orange-50/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                        day_disabled: "text-muted-foreground opacity-50",
                        day_range_middle: "aria-selected:bg-orange-50 aria-selected:text-orange-900",
                        day_hidden: "invisible",
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Seletores de Horário */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="horarioInicio">Horário Início</Label>
                  <select 
                    id="horarioInicio"
                    value={bloqueioForm.horarioInicio}
                    onChange={(e) => setBloqueioForm(prev => ({ ...prev, horarioInicio: e.target.value }))}
                    className="w-full p-2 border border-orange-200 rounded-md focus:border-orange-500 focus:ring-orange-500"
                    required
                  >
                    <option value="">Selecione</option>
                    {horariosDisponiveis.map(horario => (
                      <option key={horario} value={horario}>{horario}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="horarioFim">Horário Fim</Label>
                  <select 
                    id="horarioFim"
                    value={bloqueioForm.horarioFim}
                    onChange={(e) => setBloqueioForm(prev => ({ ...prev, horarioFim: e.target.value }))}
                    className="w-full p-2 border border-orange-200 rounded-md focus:border-orange-500 focus:ring-orange-500"
                    required
                  >
                    <option value="">Selecione</option>
                    {horariosDisponiveis.map(horario => (
                      <option key={horario} value={horario}>{horario}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Campo de Motivo */}
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo do Bloqueio</Label>
                <Textarea 
                  id="motivo"
                  value={bloqueioForm.motivo}
                  onChange={(e) => setBloqueioForm(prev => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Descreva o motivo do bloqueio"
                  className="min-h-[80px] border-orange-200 focus:border-orange-500 focus:ring-orange-500"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setModalBloqueioAberto(false);
                  // Se estiver no fluxo de aprovação, continuar para o email
                  if (aguardandoBloqueio) {
                    setAguardandoBloqueio(false);
                    setAguardandoEmail(true);
                    setTipoEmailPendente('confirmacao');
                  }
                }}
                type="button"
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={processandoAcao}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {processandoAcao ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Bloqueando...
                  </>
                ) : (
                  <>
                    <Ban className="mr-2 h-4 w-4" />
                    Bloquear Horários
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
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
                <Label className="font-semibold text-red-600">Observações sobre a ausência *</Label>
                <p className="text-xs text-gray-600 mb-2">
                  Campo obrigatório: descreva o que aconteceu, se houve comunicação prévia, etc.
                </p>
                <Textarea
                  placeholder="Ex: Avisou 1h antes por problemas no caminhão, não deu satisfação nenhuma..."
                  value={observacaoEntrega}
                  onChange={(e) => setObservacaoEntrega(e.target.value)}
                  className="mt-1 border-red-200 focus:border-red-500"
                  rows={3}
                  required
                />
              </div>

              <div>
                <Label className="font-semibold">Observações adicionais (opcional):</Label>
                <Textarea
                  placeholder="Ex: Detalhes extras sobre a situação..."
                  value={observacoesDetalhadas}
                  onChange={(e) => setObservacoesDetalhadas(e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => confirmarEntregaDetalhada('nao_compareceu')}
                  disabled={processandoEntrega || transportadorInformou === null || !observacaoEntrega.trim()}
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

      {/* Modal para Criar Novo Bloqueio */}
      <Dialog open={modalNovoBloqueio} onOpenChange={setModalNovoBloqueio}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center">
              <Ban className="h-5 w-5 mr-2" />
              🚫 Criar Novo Bloqueio
            </DialogTitle>
            <DialogDescription>
              Bloqueie horários específicos para evitar novos agendamentos neste período.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="font-semibold">Data:</Label>
              <Input
                type="date"
                value={bloqueioForm.data}
                onChange={(e) => setBloqueioForm({ ...bloqueioForm, data: e.target.value })}
                className="mt-1 border-orange-200 focus:border-orange-500 focus:ring-orange-500"
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-semibold">Horário Início:</Label>
                <Select 
                  value={bloqueioForm.horarioInicio} 
                  onValueChange={(value) => setBloqueioForm({ ...bloqueioForm, horarioInicio: value })}
                >
                  <SelectTrigger className="mt-1 border-orange-200 focus:border-orange-500 focus:ring-orange-500">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {HORARIOS_DISPONIVEIS.map(horario => (
                      <SelectItem key={horario} value={horario}>{horario}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-semibold">Horário Fim:</Label>
                <Select 
                  value={bloqueioForm.horarioFim} 
                  onValueChange={(value) => setBloqueioForm({ ...bloqueioForm, horarioFim: value })}
                >
                  <SelectTrigger className="mt-1 border-orange-200 focus:border-orange-500 focus:ring-orange-500">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {HORARIOS_DISPONIVEIS.map(horario => (
                      <SelectItem key={horario} value={horario}>{horario}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="font-semibold">Motivo do Bloqueio:</Label>
              <Textarea
                placeholder="Ex: Manutenção programada, evento especial, etc..."
                value={bloqueioForm.motivo}
                onChange={(e) => setBloqueioForm({ ...bloqueioForm, motivo: e.target.value })}
                className="mt-1 border-orange-200 focus:border-orange-500 focus:ring-orange-500"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={criarNovoBloqueio}
                disabled={processandoBloqueio || !bloqueioForm.data || !bloqueioForm.horarioInicio || !bloqueioForm.horarioFim || !bloqueioForm.motivo}
                className="bg-orange-500 hover:bg-orange-600 text-white flex-1"
              >
                {processandoBloqueio ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Criar Bloqueio
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setModalNovoBloqueio(false);
                  setBloqueioForm({ 
                    data: format(new Date(), 'yyyy-MM-dd'),
                    horarioInicio: '', 
                    horarioFim: '', 
                    motivo: ''
                  });
                }}
                disabled={processandoBloqueio}
                className="border-gray-300 hover:border-orange-300"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Pergunta sobre Bloqueio após Aprovação */}
      <Dialog open={modalBloqueioAposAprovar} onOpenChange={setModalBloqueioAposAprovar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Bloqueio de Horário
            </DialogTitle>
            <DialogDescription>
              Antes de aprovar o agendamento, deseja bloquear algum horário adicional? 
              Isso é útil quando a descarga pode demorar mais que o esperado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">💡 Quando usar o bloqueio?</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Carga com muito volume</li>
                <li>• Descarga demorada</li>
                <li>• Equipamentos especiais</li>
                <li>• Evitar conflitos de horário</li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  // Não bloquear, ir direto para aprovação
                  setModalBloqueioAposAprovar(false);
                  if (selectedAgendamento) {
                    confirmarAprovacaoAgendamento(selectedAgendamento);
                  }
                }}
                variant="outline"
                className="flex-1"
              >
                Não Bloquear
              </Button>
              
              <Button
                onClick={() => {
                  // Abrir modal de bloqueio
                  setModalBloqueioAposAprovar(false);
                  setModalNovoBloqueio(true);
                  setNovoBloqueio({
                    data: selectedAgendamento?.data_entrega || format(new Date(), 'yyyy-MM-dd'),
                    horarioInicio: '', 
                    horarioFim: '', 
                    motivo: ''
                  });
                }}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                <Clock className="w-4 h-4 mr-2" />
                Bloquear Horário
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardCD; 