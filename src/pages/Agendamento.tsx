
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { agendamentoService, uploadService } from '@/services/api';

const Agendamento = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    empresa: '',
    email: '',
    telefone: '',
    notaFiscal: '',
    numeroPedido: '',
    centroDistribuicao: '',
    dataEntrega: undefined as Date | undefined,
    horarioEntrega: '',
    volumesPaletes: '',
    valorNotaFiscal: '',
    arquivoNotaFiscal: null as File | null
  });

  const centrosDistribuicao = ['Bahia', 'Pernambuco', 'Lagoa Nova'];
  const horariosDisponiveis = [
    { value: '08:00', label: '08:00 - 09:00' },
    { value: '09:00', label: '09:00 - 10:00' },
    { value: '10:00', label: '10:00 - 11:00' },
    { value: '13:00', label: '13:00 - 14:00' },
    { value: '14:00', label: '14:00 - 15:00' },
    { value: '15:00', label: '15:00 - 16:00' }
  ];

  // Função para verificar se é dia útil
  const isDiaUtil = (date: Date) => {
    const day = date.getDay();
    return day >= 1 && day <= 5; // Segunda a sexta
  };

  // Função para obter próximos 15 dias úteis
  const getProximos15DiasUteis = () => {
    const dias = [];
    const hoje = new Date();
    let contador = 0;
    let data = new Date(hoje);

    while (contador < 15) {
      data.setDate(data.getDate() + 1);
      if (isDiaUtil(new Date(data))) {
        dias.push(new Date(data));
        contador++;
      }
    }
    return dias;
  };

  const diasUteis = getProximos15DiasUteis();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Apenas arquivos PDF são aceitos para a Nota Fiscal!');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB
        toast.error('Arquivo muito grande! Máximo 5MB.');
        return;
      }
      setFormData({...formData, arquivoNotaFiscal: file});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.empresa || !formData.email || !formData.telefone || !formData.notaFiscal || 
        !formData.numeroPedido || !formData.centroDistribuicao || !formData.dataEntrega || 
        !formData.horarioEntrega || !formData.volumesPaletes || !formData.valorNotaFiscal || !formData.arquivoNotaFiscal) {
      toast.error('Por favor, preencha todos os campos obrigatórios!');
      return;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Por favor, digite um email válido!');
      return;
    }

    // Validar valor da nota fiscal
    const valor = parseFloat(formData.valorNotaFiscal);
    if (isNaN(valor) || valor <= 0) {
      toast.error('Por favor, digite um valor válido para a nota fiscal!');
      return;
    }

    try {
      let arquivoUrl = '';
      
      // Upload do arquivo PDF
      if (formData.arquivoNotaFiscal) {
        try {
          const uploadResponse = await uploadService.uploadNotaFiscal(formData.arquivoNotaFiscal);
          
          if (uploadResponse.success && uploadResponse.filePath) {
            arquivoUrl = uploadResponse.filePath;
          } else {
            throw new Error(uploadResponse.message || 'Erro no upload do arquivo');
          }
        } catch (error: any) {
          console.error('Erro no upload:', error);
          
          // Tratar diferentes tipos de erro
          if (error.response?.status === 400) {
            const errorMessage = error.response?.data?.message || 'Arquivo inválido';
            toast.error(`❌ ${errorMessage}`);
          } else if (error.response?.status === 413) {
            toast.error('❌ Arquivo muito grande. Máximo permitido: 5MB');
          } else {
            toast.error('❌ Erro ao enviar arquivo. Verifique se é um PDF válido e tente novamente.');
          }
          return;
        }
      }

      // Preparar dados para envio
      const dadosParaEnvio = {
        empresa: formData.empresa,
        email: formData.email,
        telefone: formData.telefone,
        notaFiscal: formData.notaFiscal,
        numeroPedido: formData.numeroPedido,
        centroDistribuicao: formData.centroDistribuicao,
        dataEntrega: formData.dataEntrega!.toISOString().split('T')[0],
        horarioEntrega: formData.horarioEntrega,
        volumesPaletes: formData.volumesPaletes,
        valorNotaFiscal: valor,
        arquivoNotaFiscal: arquivoUrl,
      };

      const response = await agendamentoService.criar(dadosParaEnvio);

      if (response.success) {
        toast.success('Solicitação de agendamento enviada com sucesso! Aguarde a confirmação por email em até 48h úteis.');
        
        // Resetar formulário
        setFormData({
          empresa: '',
          email: '',
          telefone: '',
          notaFiscal: '',
          numeroPedido: '',
          centroDistribuicao: '',
          dataEntrega: undefined,
          horarioEntrega: '',
          volumesPaletes: '',
          valorNotaFiscal: '',
          arquivoNotaFiscal: null
        });
      }
    } catch (error: any) {
      console.error('Erro ao criar agendamento:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao enviar solicitação';
      toast.error(errorMessage);
    }
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
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">Solicitação de Agendamento</h1>
                <p className="text-orange-100">Preencha o formulário para agendar sua entrega</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-white hover:bg-white hover:bg-opacity-20 border-2 border-white border-opacity-30 backdrop-blur-sm"
            >
              ← Voltar ao Início
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-xl">
              <CardTitle className="text-2xl text-center font-bold">
                🚚 Solicitar Agendamento de Entrega
              </CardTitle>
              <p className="text-center text-orange-100 text-lg">
                Preencha todos os campos para solicitar o agendamento. Aguarde a confirmação por email em até 48h úteis.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="empresa">Nome da Empresa *</Label>
                    <Input
                      id="empresa"
                      type="text"
                      placeholder="Digite o nome da empresa"
                      value={formData.empresa}
                      onChange={(e) => setFormData({...formData, empresa: e.target.value})}
                      required
                      className="border-orange-200 focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email para Confirmação *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seuemail@exemplo.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                      className="border-orange-200 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone/WhatsApp *</Label>
                    <Input
                      id="telefone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={formData.telefone}
                      onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                      required
                      className="border-orange-200 focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notaFiscal">Número da Nota Fiscal *</Label>
                    <Input
                      id="notaFiscal"
                      type="text"
                      placeholder="Digite o número da NF"
                      value={formData.notaFiscal}
                      onChange={(e) => setFormData({...formData, notaFiscal: e.target.value})}
                      required
                      className="border-orange-200 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numeroPedido">Número do Pedido *</Label>
                    <Input
                      id="numeroPedido"
                      type="text"
                      placeholder="Digite o número do pedido"
                      value={formData.numeroPedido}
                      onChange={(e) => setFormData({...formData, numeroPedido: e.target.value})}
                      required
                      className="border-orange-200 focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valorNotaFiscal">Valor da Nota Fiscal (R$) *</Label>
                    <Input
                      id="valorNotaFiscal"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={formData.valorNotaFiscal}
                      onChange={(e) => setFormData({...formData, valorNotaFiscal: e.target.value})}
                      required
                      className="border-orange-200 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="volumesPaletes">Quantidade de Volumes e/ou Paletes *</Label>
                    <Input
                      id="volumesPaletes"
                      type="text"
                      placeholder="Ex: 10 volumes / 5 paletes"
                      value={formData.volumesPaletes}
                      onChange={(e) => setFormData({...formData, volumesPaletes: e.target.value})}
                      required
                      className="border-orange-200 focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="centroDistribuicao">Centro de Distribuição *</Label>
                    <Select
                      value={formData.centroDistribuicao}
                      onValueChange={(value) => setFormData({...formData, centroDistribuicao: value})}
                    >
                      <SelectTrigger className="border-orange-200 focus:border-orange-500">
                        <SelectValue placeholder="Selecione o centro de distribuição" />
                      </SelectTrigger>
                      <SelectContent>
                        {centrosDistribuicao.map((centro) => (
                          <SelectItem key={centro} value={centro}>
                            {centro}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Desejada para Entrega *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal border-orange-200 focus:border-orange-500",
                            !formData.dataEntrega && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.dataEntrega ? (
                            format(formData.dataEntrega, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            <span>Escolha uma data</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.dataEntrega}
                          onSelect={(date) => setFormData({...formData, dataEntrega: date})}
                          disabled={(date) => !diasUteis.some(d => d.toDateString() === date.toDateString())}
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="horarioEntrega">Horário Desejado *</Label>
                    <Select
                      value={formData.horarioEntrega}
                      onValueChange={(value) => setFormData({...formData, horarioEntrega: value})}
                    >
                      <SelectTrigger className="border-orange-200 focus:border-orange-500">
                        <SelectValue placeholder="Selecione o horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {horariosDisponiveis.map((horario) => (
                          <SelectItem key={horario.value} value={horario.value}>
                            {horario.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arquivoNotaFiscal">Upload da Nota Fiscal (PDF) *</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="arquivoNotaFiscal"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      required
                      className="border-orange-200 focus:border-orange-500"
                    />
                    <Upload className="w-5 h-5 text-orange-500" />
                  </div>
                  {formData.arquivoNotaFiscal && (
                    <p className="text-sm text-green-600">
                      ✓ Arquivo selecionado: {formData.arquivoNotaFiscal.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Apenas arquivos PDF. Tamanho máximo: 5MB
                  </p>
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-xl border-2 border-orange-200 shadow-md">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full mb-3">
                      <span className="text-white text-xl">⏱️</span>
                    </div>
                    <p className="text-orange-800 font-semibold">
                      Após o agendamento, o prazo para confirmação via e-mail é de até 48h úteis.
                  </p>
                  </div>
                </div>

                <Button 
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  size="lg"
                >
                  Enviar Solicitação de Agendamento
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Agendamento;
