
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ArrowRight, User, Lock, Clock, MapPin, Truck, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authService } from '@/services/api';

const Index = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(() => {
    // Recuperar tentativas do localStorage
    const saved = localStorage.getItem('loginAttempts');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Log apenas para debug em desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    console.log('🔄 Brisa Agenda carregado. Tentativas:', loginAttempts);
  }

  const handleLogin = useCallback(async () => {
    // Evitar múltiplos submits
    if (loading) {
      return;
    }

    // Validações prévias
    if (!username.trim() || !password.trim()) {
      toast.error('⚠️ Por favor, preencha usuário e senha.');
      return;
    }

    if (username.trim().length < 2) {
      toast.error('⚠️ Nome de usuário deve ter pelo menos 2 caracteres.');
      return;
    }

    if (password.length < 3) {
      toast.error('⚠️ Senha deve ter pelo menos 3 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.login(username.trim(), password);
      
      if (response.success) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('username', response.user.username);
        
        // Resetar contador de tentativas após sucesso
        setLoginAttempts(0);
        localStorage.removeItem('loginAttempts');
        
        toast.success('Login realizado com sucesso!');
        
        if (response.user.primeira_senha) {
          toast.info('É necessário alterar sua senha no primeiro acesso');
          setTimeout(() => {
            navigate('/change-password');
          }, 1500);
          return;
        }
        
        setTimeout(() => {
          if (response.user.role === 'admin') {
            navigate('/admin');
          } else if (response.user.role === 'institution') {
            navigate('/dashboard-cd');
          } else if (response.user.role === 'consultivo') {
            navigate('/dashboard-consultivo');
          } else {
            navigate('/dashboard-consultivo');
          }
        }, 1500);
      } else {
        toast.error(response.message || 'Erro ao fazer login');
      }
    } catch (error: any) {
      // Incrementar tentativas
      const novasTentativas = loginAttempts + 1;
      setLoginAttempts(novasTentativas);
      
              // Salvar no localStorage
        localStorage.setItem('loginAttempts', novasTentativas.toString());
      
      // Mostrar erro
      toast.error(`❌ Usuário ou senha incorretos (${novasTentativas}ª tentativa).`);
      
      // Mostrar dica após 2 tentativas
      if (novasTentativas >= 2) {
        // Mostrar dica imediatamente
        toast.info('💡 Dica: Verifique suas credenciais ou solicite uma nova senha.', {
          duration: 8000
        });
        
        // E também depois de um delay para garantir
        setTimeout(() => {
          toast.success('🔑 Lembrete: Use o botão abaixo para solicitar nova senha se necessário', {
            duration: 10000
          });
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  }, [username, password, loading, loginAttempts, navigate]);

  // Detectar recarregamento da página e proteger contra submits indevidos
  useEffect(() => {
    const handleFormSubmit = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleLogin();
        return false;
      }
    };

    document.addEventListener('submit', handleFormSubmit);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('submit', handleFormSubmit);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleLogin]);

  // Mostrar dica automaticamente se houver tentativas salvas
  useEffect(() => {
    const savedAttempts = localStorage.getItem('loginAttempts');
    const attempts = savedAttempts ? parseInt(savedAttempts, 10) : 0;
    
    if (attempts >= 2) {
      setTimeout(() => {
        toast.info(`💡 Dica: Você já teve ${attempts} tentativa(s). Verifique suas credenciais ou solicite nova senha.`, {
          duration: 8000
        });
      }, 1000);
    }
  }, []);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* LADO ESQUERDO - Convite para Agendamento */}
      <div className="flex-1 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 relative overflow-hidden">
        {/* Elementos Decorativos de Fundo */}
        <div className="absolute inset-0">
          {/* Círculos flutuantes */}
          <div className="absolute top-20 left-16 w-32 h-32 bg-white opacity-10 rounded-full animate-pulse"></div>
          <div className="absolute top-40 right-20 w-24 h-24 bg-white opacity-15 rounded-full animate-pulse delay-1000"></div>
          <div className="absolute bottom-32 left-32 w-20 h-20 bg-white opacity-10 rounded-full animate-pulse delay-500"></div>
          <div className="absolute bottom-20 right-40 w-16 h-16 bg-white opacity-20 rounded-full animate-pulse delay-700"></div>
          
          {/* Formas geométricas */}
          <div className="absolute top-1/4 left-1/4 w-8 h-8 bg-white opacity-20 rotate-45 animate-spin" style={{animationDuration: '20s'}}></div>
          <div className="absolute bottom-1/3 right-1/3 w-6 h-6 bg-white opacity-15 rotate-12 animate-spin" style={{animationDuration: '15s'}}></div>
        </div>

        {/* Conteúdo Principal */}
        <div className="relative z-10 flex flex-col justify-center h-full px-12 text-white">
          {/* Logo e Header */}
          <div className="mb-8">
            {/* Logo Estilizado */}
            <div className="mb-6">
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-4 inline-block border border-white border-opacity-30">
                <h1 className="text-2xl font-bold text-white flex items-center">
                  <span className="bg-white text-orange-600 px-3 py-1 rounded-lg mr-3 text-lg font-black">
                    BRISA
                  </span>
                  <span className="font-light">Agenda</span>
                </h1>
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-5xl font-bold leading-tight drop-shadow-lg">
                Bem-vindo!
              </h2>
              <div className="w-20 h-1 bg-white rounded-full"></div>
            </div>
          </div>

          {/* Texto Principal */}
          <div className="space-y-6 mb-8">
            <h2 className="text-3xl font-light leading-relaxed">
              Deseja fazer um <br />
              <span className="font-bold text-white">agendamento?</span>
          </h2>
            
            <p className="text-xl opacity-90 leading-relaxed max-w-md">
              Simplifique suas entregas nos Centros de Distribuição da Brisanet. 
              Rápido, seguro e eficiente.
          </p>
        </div>

          {/* Botão Principal */}
          <div className="mb-8">
            <Button 
              onClick={() => navigate('/agendamento')}
              size="lg"
              className="bg-white text-orange-600 hover:bg-orange-50 font-bold text-lg px-8 py-4 rounded-full shadow-2xl transform hover:scale-105 transition-all duration-300 group"
            >
              <Calendar className="w-6 h-6 mr-3 group-hover:animate-bounce" />
              Clique Aqui para Agendar
              <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Cards de Informações */}
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-4 border border-white border-opacity-30">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="w-5 h-5 text-white" />
                <h4 className="font-semibold text-sm">Horários</h4>
              </div>
              <p className="text-xs opacity-90">
                Seg-Sex<br />
                08h-11h | 13h-16h
              </p>
            </div>
            
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-4 border border-white border-opacity-30">
              <div className="flex items-center space-x-2 mb-2">
                <MapPin className="w-5 h-5 text-white" />
                <h4 className="font-semibold text-sm">Centros</h4>
              </div>
              <p className="text-xs opacity-90">
                Bahia, Pernambuco<br />
                Lagoa Nova
              </p>
            </div>
          </div>

          {/* Benefícios */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-white" />
              <span className="text-sm opacity-90">Agendamento em tempo real</span>
            </div>
            <div className="flex items-center space-x-3">
              <Truck className="w-5 h-5 text-white" />
              <span className="text-sm opacity-90">Confirmação por email</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-white" />
              <span className="text-sm opacity-90">Suporte dedicado</span>
            </div>
          </div>
        </div>
      </div>

      {/* LADO DIREITO - Login Institucional */}
      <div className="flex-1 bg-gradient-to-bl from-gray-50 to-gray-100 flex flex-col justify-center relative">
        {/* Elementos Decorativos Sutis */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 right-20 w-40 h-40 border-2 border-orange-300 rounded-full"></div>
          <div className="absolute bottom-32 right-32 w-24 h-24 border border-orange-200 rounded-full"></div>
        </div>

        <div className="relative z-10 w-full max-w-md mx-auto p-8">
          {/* Header do Login */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full mb-6 shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Área Institucional</h1>
            <p className="text-gray-600 text-lg">Acesse sua conta para gerenciar agendamentos</p>
            <div className="w-16 h-1 bg-gradient-to-r from-orange-400 to-orange-600 mx-auto mt-4 rounded-full"></div>
          </div>

          {/* Formulário de Login */}
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-xl">
              <CardTitle className="text-xl text-center font-semibold">
                🔐 Login do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-gray-700 font-medium">Usuário</Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="Digite seu usuário"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleLogin();
                        }
                      }}
                      required
                      className="pl-11 h-12 border-2 border-gray-200 focus:border-orange-500 focus:ring-orange-500 rounded-xl transition-all"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 font-medium">Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleLogin();
                        }
                      }}
                      required
                      className="pl-11 h-12 border-2 border-gray-200 focus:border-orange-500 focus:ring-orange-500 rounded-xl transition-all"
                    />
                  </div>
                </div>

                <Button 
                  type="button" 
                  className={`w-full ${loginAttempts > 0 ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700' : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'} text-white font-semibold py-3 h-12 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200`}
                  disabled={loading}
                  onClick={() => {
                    handleLogin();
                  }}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Entrando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 mr-2" />
                      {loginAttempts > 0 ? `Tentar Novamente (${loginAttempts} erro${loginAttempts > 1 ? 's' : ''})` : 'Acessar'}
                    </>
                  )}
                </Button>
              </div>

              {/* Informações do Sistema */}
              <div className="mt-6 space-y-4">
                

                                 {/* Dica de Recuperação de Senha - Só aparece após 2 tentativas */}
                 {loginAttempts >= 2 && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 animate-fade-in border-l-4 border-l-blue-500 shadow-lg">
                    <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                      <span className="mr-2">🔑</span>
                      Esqueceu a Senha? ({loginAttempts} tentativa{loginAttempts > 1 ? 's' : ''} falhada{loginAttempts > 1 ? 's' : ''})
                    </h4>
                                         <p className="text-xs text-blue-700 mb-3">
                       Clique no botão abaixo para solicitar uma nova senha por email:
              </p>
              <Button 
                      onClick={() => {
                        const to = 'wanderson.goncalves@grupobrisanet.com.br';
                        const subject = encodeURIComponent('Solicitação de Nova Senha - Brisa Agenda');
                        const body = encodeURIComponent(`Olá,

Solicito uma nova senha para acessar o sistema Brisa Agenda.

Dados da solicitação:
- Sistema: Brisa Agenda
- Usuário: ${username || '[Informe seu usuário]'}
- Data/Hora: ${new Date().toLocaleString('pt-BR')}

Aguardo retorno.

Atenciosamente.`);
                        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
                        window.open(gmailUrl, '_blank');
                      }}
                variant="outline"
                      size="sm"
                      className="w-full text-xs h-8 bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200 hover:border-blue-400"
              >
                      📧 Clique Aqui para Solicitar Nova Senha
              </Button>
                  </div>
                )}

                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center">
                    <span className="mr-2">📍</span>
                    Centros de Distribuição
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {['Bahia', 'Pernambuco', 'Lagoa Nova'].map((centro) => (
                      <span 
                        key={centro} 
                        className="inline-flex items-center px-3 py-1 text-xs font-medium bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 rounded-full border border-orange-300"
                      >
                        {centro}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-500">
              <span className="font-semibold">Brisa Agenda</span> - Sistema de Agendamento de Entregas
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Desenvolvido por <span className="font-semibold text-orange-500">Wanderson Davyd</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
