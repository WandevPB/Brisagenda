import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, LogOut, FileText, ExternalLink, Filter, X, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { agendamentoService } from '@/services/api';
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const DashboardConsultivo = () => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroNotaFiscal, setFiltroNotaFiscal] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroCentroDistribuicao, setFiltroCentroDistribuicao] = useState('');
  const navigate = useNavigate();

  // Obter dados do usuário
  const userDataString = localStorage.getItem('user');
  const userData = userDataString ? JSON.parse(userDataString) : null;
  const userName = userData?.username || 'Usuário';
  const userRole = userData?.role || '';

  // Verificar se é usuário consultivo
  const isConsultivo = userRole === 'consultivo';

  useEffect(() => {
    carregarAgendamentos();
  }, []);

  const carregarAgendamentos = async () => {
    try {
      setLoading(true);
      const response = await agendamentoService.listar();
      
      if (response.success) {
        // Usuários consultivos veem todos os agendamentos
        setAgendamentos(response.data);
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

  const limparFiltros = () => {
    setFiltroEmpresa('');
    setFiltroNotaFiscal('');
    setFiltroStatus('');
    setFiltroCentroDistribuicao('');
  };

  // Filtrar agendamentos
  const agendamentosFiltrados = agendamentos.filter(agendamento => {
    const matchEmpresa = agendamento.empresa.toLowerCase().includes(filtroEmpresa.toLowerCase());
    const matchNotaFiscal = agendamento.nota_fiscal.toLowerCase().includes(filtroNotaFiscal.toLowerCase());
    const matchStatus = filtroStatus === '' || agendamento.status === filtroStatus;
    const matchCentroDistribuicao = filtroCentroDistribuicao === '' || agendamento.centro_distribuicao === filtroCentroDistribuicao;
    
    return matchEmpresa && matchNotaFiscal && matchStatus && matchCentroDistribuicao;
  });

  // Estatísticas por CD e status
  const estatisticasPorCD = ['Bahia', 'Pernambuco', 'Lagoa Nova'].map(cd => ({
    cd,
    total: agendamentos.filter(ag => ag.centro_distribuicao === cd).length,
    pendentes: agendamentos.filter(ag => ag.centro_distribuicao === cd && ag.status === 'pendente_confirmacao').length,
    confirmados: agendamentos.filter(ag => ag.centro_distribuicao === cd && ag.status === 'confirmado').length,
  }));

  const estatisticasGerais = {
    total: agendamentos.length,
    pendentes: agendamentos.filter(ag => ag.status === 'pendente_confirmacao').length,
    confirmados: agendamentos.filter(ag => ag.status === 'confirmado').length,
    sugestoes: agendamentos.filter(ag => ag.status === 'sugestao_enviada').length,
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
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                  📊 Dashboard Consultivo - {userName}
                </h1>
                <p className="text-orange-100">
                  {userName === 'PCM' && 'Planejamento e Controle de Materiais'}
                  {userName === 'Transportes' && 'Setor de Transportes'}
                  {userName === 'Compras' && 'Setor de Compras'}
                  {!['PCM', 'Transportes', 'Compras'].includes(userName) && 'Visualização Consultiva'}
                </p>
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
          {/* Estatísticas Gerais */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="border-2 border-orange-200 bg-orange-50">
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{estatisticasGerais.total}</div>
                  <p className="text-xs text-orange-700">Total Geral</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{estatisticasGerais.pendentes}</div>
                  <p className="text-xs text-yellow-700">Pendentes</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{estatisticasGerais.confirmados}</div>
                  <p className="text-xs text-green-700">Confirmados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{estatisticasGerais.sugestoes}</div>
                  <p className="text-xs text-blue-700">Sugestões</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estatísticas por CD */}
          <Card className="shadow-xl border-2 border-orange-200">
            <CardHeader>
              <CardTitle className="text-orange-600 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Visão Geral por Centro de Distribuição
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {estatisticasPorCD.map((stat) => (
                  <div key={stat.cd} className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                    <h3 className="font-bold text-lg text-orange-800 mb-3">{stat.cd}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total:</span>
                        <span className="font-semibold text-orange-600">{stat.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Pendentes:</span>
                        <span className="font-semibold text-yellow-600">{stat.pendentes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Confirmados:</span>
                        <span className="font-semibold text-green-600">{stat.confirmados}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Filtros */}
          <Card className="shadow-lg border-2 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <Filter className="h-5 w-5" />
                Filtros de Pesquisa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <Label htmlFor="filtroCentroDistribuicao">Centro de Distribuição</Label>
                  <select
                    id="filtroCentroDistribuicao"
                    className="w-full p-2 border border-orange-200 rounded-md focus:border-orange-500"
                    value={filtroCentroDistribuicao}
                    onChange={(e) => setFiltroCentroDistribuicao(e.target.value)}
                  >
                    <option value="">Todos os CDs</option>
                    <option value="Bahia">Bahia</option>
                    <option value="Pernambuco">Pernambuco</option>
                    <option value="Lagoa Nova">Lagoa Nova</option>
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
            </CardContent>
          </Card>

          {/* Lista de Agendamentos */}
          <Card className="shadow-xl border-2 border-orange-200">
            <CardHeader>
              <CardTitle className="text-orange-600">
                📋 Agendamentos - Visualização Completa ({agendamentosFiltrados.length})
              </CardTitle>
              <p className="text-sm text-gray-600">
                {isConsultivo && 'Visualização consultiva de todos os agendamentos dos centros de distribuição'}
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Carregando agendamentos...</p>
                </div>
              ) : agendamentosFiltrados.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">Nenhum agendamento encontrado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-orange-50">
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Empresa</th>
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Nota Fiscal</th>
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Centro de Distribuição</th>
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Data/Horário</th>
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Status</th>
                        <th className="border border-gray-200 px-4 py-2 text-left text-orange-600 font-semibold">Ver Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agendamentosFiltrados.map((agendamento) => (
                        <tr key={agendamento.id} className="hover:bg-orange-25">
                          <td className="border border-gray-200 px-4 py-2">{agendamento.empresa}</td>
                          <td className="border border-gray-200 px-4 py-2 font-mono text-sm">{agendamento.nota_fiscal}</td>
                          <td className="border border-gray-200 px-4 py-2">{agendamento.centro_distribuicao}</td>
                          <td className="border border-gray-200 px-4 py-2">
                            {format(new Date(agendamento.data_entrega), "dd/MM/yyyy", { locale: ptBR })} às {formatarHorario(agendamento.horario_entrega)}
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <Badge className={`${getStatusColor(agendamento.status)}`}>
                              {formatarStatus(agendamento.status)}
                            </Badge>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVerDetalhes(agendamento)}
                              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 shadow-md transform hover:scale-105 transition-all"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver Detalhes
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

      {/* Modal de Detalhes - APENAS VISUALIZAÇÃO */}
      {modalDetalhesAberto && agendamentoSelecionado && (
        <Dialog open={modalDetalhesAberto} onOpenChange={setModalDetalhesAberto}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-orange-600">
                👁️ Visualização de Agendamento - {agendamentoSelecionado.empresa}
              </DialogTitle>
              <p className="text-sm text-gray-600">Visualização consultiva - somente leitura</p>
            </DialogHeader>
            
            <div className="space-y-4">
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

              {/* Status e Datas */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3">📊 Status e Timeline</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold text-gray-700">Status Atual:</Label>
                    <Badge className={`${getStatusColor(agendamentoSelecionado.status)} mt-1`}>
                      {formatarStatus(agendamentoSelecionado.status)}
                    </Badge>
                  </div>
                  <div>
                    <Label className="font-semibold text-gray-700">Solicitação Criada em:</Label>
                    <p className="text-gray-800 font-medium">
                      {format(new Date(agendamentoSelecionado.data_solicitacao || agendamentoSelecionado.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Nota Fiscal */}
              {agendamentoSelecionado.arquivo_nota_fiscal && (
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

              {/* Observações */}
              {agendamentoSelecionado.observacoes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600 flex items-center gap-2">
                      💬 Observações
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-blue-800">{agendamentoSelecionado.observacoes}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Confirmação */}
              {agendamentoSelecionado.confirmado_por && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-green-600 flex items-center gap-2">
                      ✅ Confirmação
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-green-800">
                        <strong>Confirmado por:</strong> {agendamentoSelecionado.confirmado_por}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default DashboardConsultivo; 