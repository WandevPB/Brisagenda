import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Função auxiliar para criar uma data local sem problemas de timezone
const criarDataLocal = (data: Date | string): Date => {
  if (data instanceof Date) {
    return data;
  }
  
  // Se é uma string no formato YYYY-MM-DD, criar data local
  if (typeof data === 'string' && data.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [ano, mes, dia] = data.split('-').map(Number);
    return new Date(ano, mes - 1, dia); // Mês é 0-indexado
  }
  
  // Para outros formatos, usar Date normal
  return new Date(data);
};

// Função para formatar data no padrão brasileiro DD/MM/AAAA
export const formatarDataBrasileira = (data: Date | string): string => {
  try {
    const dataObj = criarDataLocal(data);
    return format(dataObj, "dd/MM/yyyy", { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return 'Data inválida';
  }
};

// Função para formatar data e hora no padrão brasileiro DD/MM/AAAA HH:mm
export const formatarDataHoraBrasileira = (data: Date | string): string => {
  try {
    const dataObj = criarDataLocal(data);
    return format(dataObj, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data/hora:', error);
    return 'Data inválida';
  }
};

// Função para converter data DD/MM/AAAA para AAAA-MM-DD (formato do banco)
export const converterParaFormatoBanco = (dataBrasileira: string): string => {
  try {
    const [dia, mes, ano] = dataBrasileira.split('/');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  } catch (error) {
    console.error('Erro ao converter data para formato do banco:', error);
    return '';
  }
};

// Função para converter data AAAA-MM-DD (formato do banco) para DD/MM/AAAA
export const converterDoBanco = (dataBanco: string): string => {
  try {
    const [ano, mes, dia] = dataBanco.split('-');
    return `${dia}/${mes}/${ano}`;
  } catch (error) {
    console.error('Erro ao converter data do banco:', error);
    return 'Data inválida';
  }
};
