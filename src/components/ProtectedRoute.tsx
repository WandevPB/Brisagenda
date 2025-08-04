import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin, needsPasswordChange, loading, user } = useAuth();
  const location = useLocation();

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Redirecionar para login se não estiver autenticado
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Redirecionar para troca de senha se for primeira senha
  if (needsPasswordChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Verificar se a rota requer admin
  if (adminOnly && !isAdmin) {
    // Redirecionar baseado no role do usuário
    if (user?.role === 'institution') {
      return <Navigate to="/dashboard-cd" replace />;
    } else if (user?.role === 'consultivo') {
      return <Navigate to="/dashboard-instituicao" replace />;
    } else {
      return <Navigate to="/dashboard-instituicao" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute; 