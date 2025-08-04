import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authService } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';

const ChangePassword = () => {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (novaSenha.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error('As senhas não conferem');
      return;
    }

    if (novaSenha === 'Brisanet123') {
      toast.error('Por favor, escolha uma senha diferente da padrão');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.changePassword(novaSenha);
      
      if (response.success) {
        toast.success('Senha alterada com sucesso!');
        
        // Atualizar dados do usuário
        updateUser({ primeira_senha: false });
        
        // Redirecionar baseado na role
        setTimeout(() => {
          if (user?.role === 'admin') {
            navigate('/admin');
          } else if (user?.role === 'institution') {
            navigate('/dashboard-cd');
          } else if (user?.role === 'consultivo') {
            navigate('/dashboard-instituicao');
          } else {
            navigate('/dashboard-instituicao');
          }
        }, 1500);
      }
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      toast.error(error.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 relative overflow-hidden">
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute inset-0">
        {/* Círculos flutuantes */}
        <div className="absolute top-20 left-16 w-32 h-32 bg-white opacity-10 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-white opacity-15 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-32 w-20 h-20 bg-white opacity-10 rounded-full animate-pulse delay-500"></div>
        
        {/* Formas geométricas */}
        <div className="absolute top-1/4 left-1/4 w-8 h-8 bg-white opacity-20 rotate-45 animate-spin" style={{animationDuration: '20s'}}></div>
        <div className="absolute bottom-1/3 right-1/3 w-6 h-6 bg-white opacity-15 rotate-12 animate-spin" style={{animationDuration: '15s'}}></div>
      </div>

      {/* Conteúdo Principal */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        {/* Header com Logo */}
        <div className="text-center mb-8">
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

          <h2 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
            Alteração de Senha
          </h2>
          <p className="text-xl text-white opacity-90">
            Sistema de Agendamento de Entregas Brisanet
          </p>
          <div className="w-20 h-1 bg-white rounded-full mx-auto mt-4"></div>
        </div>

        {/* Card Principal */}
        <div className="w-full max-w-md">

        <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-t-xl">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white border-opacity-30">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center font-bold">
              🔒 Alteração de Senha Obrigatória
            </CardTitle>
            <p className="text-center text-red-100 text-lg">
              Por segurança, você deve alterar sua senha no primeiro acesso
            </p>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-xl p-4 mt-4">
              <p className="text-white font-semibold">
                <strong>👤 Usuário:</strong> {user.username}
              </p>
              <p className="text-red-100 mt-2">
                Esta é sua primeira vez acessando o sistema. Por favor, defina uma nova senha segura.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="novaSenha">Nova Senha *</Label>
                <div className="relative">
                  <Input
                    id="novaSenha"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua nova senha"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                    className="border-orange-200 focus:border-orange-500 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Mínimo de 6 caracteres. Deve ser diferente de "Brisanet123"
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmarSenha">Confirmar Nova Senha *</Label>
                <div className="relative">
                  <Input
                    id="confirmarSenha"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirme sua nova senha"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    required
                    className="border-orange-200 focus:border-orange-500 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">
                  Dicas para uma senha segura:
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Pelo menos 6 caracteres</li>
                  <li>• Combine letras, números e símbolos</li>
                  <li>• Não use informações pessoais</li>
                  <li>• Não compartilhe com outras pessoas</li>
                </ul>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Lock className="w-4 h-4 mr-2 animate-spin" />
                    Alterando Senha...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Alterar Senha
                  </>
                )}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                Após alterar a senha, você será redirecionado para o sistema.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white opacity-90">
            <span className="font-semibold">Brisa Agenda</span> - Sistema de Agendamento de Entregas
          </p>
          <p className="text-white opacity-75 text-sm mt-1">
            Desenvolvido por <span className="font-semibold">Wanderson Davyd</span>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ChangePassword; 