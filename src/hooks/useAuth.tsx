import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/api';

interface User {
  id: number;
  username: string;
  role: string;
  centro_distribuicao?: string;
  primeira_senha: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');

      if (!token || !userData) {
        setLoading(false);
        return;
      }

      // Verificar se o token ainda é válido
      const response = await authService.validate();
      
      if (response.valid) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        
        // Verificar se é primeira senha e redirecionar se necessário
        if (parsedUser.primeira_senha && window.location.pathname !== '/change-password') {
          navigate('/change-password');
          return;
        }
      } else {
        // Token inválido, limpar dados
        logout();
      }
    } catch (error) {
      console.error('Erro na verificação de autenticação:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = (userData: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('username', userData.username);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('username');
    setUser(null);
          navigate('/');
  };

  const updateUser = (updatedUser: Partial<User>) => {
    if (user) {
      const newUser = { ...user, ...updatedUser };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const needsPasswordChange = user?.primeira_senha === true;

  return {
    user,
    loading,
    isAuthenticated,
    isAdmin,
    needsPasswordChange,
    login,
    logout,
    updateUser,
    checkAuth
  };
};

export default useAuth; 