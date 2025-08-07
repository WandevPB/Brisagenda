import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Criar instância do axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token nas requisições

// Interceptor para adicionar token nas requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para lidar com respostas
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado ou inválido
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Serviços de autenticação
export const authService = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },
  
  validate: async () => {
    const response = await api.get('/auth/validate');
    return response.data;
  },

  changePassword: async (novaSenha: string) => {
    const response = await api.post('/auth/change-password', { novaSenha });
    return response.data;
  },

  resetPassword: async (username: string) => {
    const response = await api.post('/auth/reset-password', { username });
    return response.data;
  },

  listUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },
};

// Serviços de bloqueio de horários
export const bloqueioService = {
  bloquear: async (dados: {
    agendamentoId?: number;
    data?: string;
    horarioInicio: string;
    horarioFim: string;
    motivo: string;
  }) => {
    const response = await api.post('/agendamentos/bloquear-horarios', dados);
    return response.data;
  },

  listar: async (data?: string) => {
    const params = new URLSearchParams();
    if (data) params.append('data', data);
    const response = await api.get(`/agendamentos/bloqueios?${params}`);
    return response.data;
  },

  remover: async (id: number) => {
    const response = await api.delete(`/agendamentos/bloqueios/${id}`);
    return response.data;
  }
};

// Serviços de agendamento
export const agendamentoService = {
  criar: async (dados: any) => {
    const response = await api.post('/agendamentos', dados);
    return response.data;
  },
  
  listar: async () => {
    const response = await api.get('/agendamentos');
    return response.data;
  },
  
  buscarPorId: async (id: string) => {
    const response = await api.get(`/agendamentos/${id}`);
    return response.data;
  },

  getHorariosDisponiveis: async (data: string, cd: string) => {
    try {
      const response = await api.get(`/agendamentos/horarios-disponiveis?data=${data}&centroDistribuicao=${cd}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar horários disponíveis:', error);
      throw error;
    }
  },

  atualizarStatus: async (id: string, status: string, observacoes?: string) => {
    const response = await api.patch(`/agendamentos/${id}/status`, {
      status,
      observacoes,
    });
    return response.data;
  },
  
  sugerirHorario: async (id: string, dataEntrega: string, horarioEntrega: string, observacoes?: string) => {
    const response = await api.patch(`/agendamentos/${id}/sugerir-horario`, {
      dataEntrega,
      horarioEntrega,
      observacoes,
    });
    return response.data;
  },
};

// Serviço para upload de arquivos
export const uploadService = {
  uploadNotaFiscal: async (file: File) => {
    const formData = new FormData();
    formData.append('arquivo', file);
    
    const response = await api.post('/upload/nota-fiscal', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Serviços de relatórios (admin)
export const relatorioService = {
  obterDadosCSV: async (filtros?: any) => {
    const params = new URLSearchParams();
    if (filtros?.dataInicio) params.append('dataInicio', filtros.dataInicio);
    if (filtros?.dataFim) params.append('dataFim', filtros.dataFim);
    if (filtros?.centroDistribuicao) params.append('centroDistribuicao', filtros.centroDistribuicao);
    
    const response = await api.get(`/agendamentos/relatorios/csv?${params}`);
    return response.data;
  },
  
  obterEstatisticas: async () => {
    const response = await api.get('/agendamentos/relatorios/estatisticas');
    return response.data;
  },
};

// Serviços de gerenciamento de banco (admin)
export const databaseService = {
  // Listar tabelas
  listarTabelas: async () => {
    const response = await api.get('/database/tables');
    return response.data;
  },
  
  // Obter estrutura da tabela
  obterEstrutura: async (nomeTabela: string) => {
    const response = await api.get(`/database/table/${nomeTabela}/schema`);
    return response.data;
  },
  
  // Obter dados da tabela
  obterDados: async (nomeTabela: string, page: number = 1, limit: number = 50) => {
    const response = await api.get(`/database/table/${nomeTabela}/data?page=${page}&limit=${limit}`);
    return response.data;
  },
  
  // Executar query
  executarQuery: async (query: string) => {
    const response = await api.post('/database/query', { query });
    return response.data;
  },
  
  // Obter estatísticas
  obterEstatisticas: async () => {
    const response = await api.get('/database/stats');
    return response.data;
  },
  
  // Fazer backup
  fazerBackup: async () => {
    const response = await api.post('/database/backup');
    return response.data;
  },
  
  // Limpar dados antigos
  limparDados: async (dias: number = 30) => {
    const response = await api.post('/database/cleanup', { days: dias });
    return response.data;
  },
};

// Serviços de gerenciamento de usuários (admin)
export const usuarioService = {
  // Listar usuários
  listar: async () => {
    const response = await api.get('/usuarios');
    return response.data;
  },
  
  // Criar usuário
  criar: async (dados: any) => {
    const response = await api.post('/usuarios', dados);
    return response.data;
  },
  
  // Editar usuário
  editar: async (id: string, dados: any) => {
    const response = await api.put(`/usuarios/${id}`, dados);
    return response.data;
  },
  
  // Alterar senha
  alterarSenha: async (id: string, novaSenha: string) => {
    const response = await api.put(`/usuarios/${id}/senha`, { novaSenha });
    return response.data;
  },
  
  // Deletar usuário
  deletar: async (id: string) => {
    const response = await api.delete(`/usuarios/${id}`);
    return response.data;
  },
  
  // Obter estatísticas
  obterEstatisticas: async () => {
    const response = await api.get('/usuarios/estatisticas');
    return response.data;
  },
};

// Serviços de gerenciamento de entregas (CD)
export const entregaService = {
  // Buscar entregas de hoje
  buscarEntregasHoje: async () => {
    const response = await api.get('/entrega/hoje');
    return response.data;
  },

  // Buscar entregas pendentes de confirmação
  buscarEntregasPendentes: async () => {
    const response = await api.get('/entrega/pendentes');
    return response.data;
  },

  // Confirmar status de entrega
  confirmarEntrega: async (id: string, statusEntrega: string, observacoes?: string) => {
    const response = await api.put(`/entrega/${id}/confirmar`, {
      status_entrega: statusEntrega,
      observacoes_entrega: observacoes
    });
    return response.data;
  },

  // Confirmar entrega com dados detalhados
  confirmarEntregaDetalhada: async (id: string, dados: {
    status_entrega: string;
    observacoes_entrega?: string;
    entregue_no_horario?: boolean;
    transportador_informou?: boolean;
    observacoes_detalhadas?: string;
    horario_chegada?: string;
  }) => {
    const response = await api.put(`/entrega/${id}/confirmar`, dados);
    return response.data;
  },

  // Obter estatísticas de entregas
  obterEstatisticas: async (periodo: number = 30) => {
    const response = await api.get(`/entrega/estatisticas?periodo=${periodo}`);
    return response.data;
  },
};

export default api; 