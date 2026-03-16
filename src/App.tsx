import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { Layout } from "@/components/Layout";
import Login from "./pages/Login";
import PDV from "./pages/PDV";
import Mesas from "./pages/Mesas";
import Pedidos from "./pages/Pedidos";
import Clientes from "./pages/Clientes";
import Estoque from "./pages/Estoque";
import Produtos from "./pages/Produtos";
import Relatorios from "./pages/Relatorios";
import Entregas from "./pages/Entregas";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Mesas /></ProtectedRoute>} />
        <Route path="/pdv" element={<ProtectedRoute><PDV /></ProtectedRoute>} />
        <Route path="/pedidos" element={<ProtectedRoute><Pedidos /></ProtectedRoute>} />
        <Route path="/entregas" element={<ProtectedRoute><Entregas /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute adminOnly><Clientes /></ProtectedRoute>} />
        <Route path="/produtos" element={<ProtectedRoute adminOnly><Produtos /></ProtectedRoute>} />
        <Route path="/estoque" element={<ProtectedRoute adminOnly><Estoque /></ProtectedRoute>} />
        <Route path="/relatorios" element={<ProtectedRoute adminOnly><Relatorios /></ProtectedRoute>} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <StoreProvider>
            <AppRoutes />
          </StoreProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
