import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { useAttendantPermissions, AttendantPermissions } from "@/hooks/use-attendant-permissions";
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
import Caixa from "./pages/Caixa";
import Configuracoes from "./pages/Configuracoes";
import SuperAdmin from "./pages/SuperAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

type PermissionKey = keyof AttendantPermissions;

function ProtectedRoute({ children, adminOnly = false, superadminOnly = false, permissionKey }: { children: React.ReactNode; adminOnly?: boolean; superadminOnly?: boolean; permissionKey?: PermissionKey }) {
  const { user, isAdmin } = useAuth();
  const { permissions } = useAttendantPermissions();
  if (!user) return <Navigate to="/login" replace />;
  if (superadminOnly && user.role !== 'superadmin') return <Navigate to={`/${user.tenantSlug}`} replace />;
  // For admin-only routes with a permissionKey, allow if admin OR has permission
  if (adminOnly && !isAdmin) {
    if (!permissionKey || !permissions[permissionKey]) {
      return <Navigate to={`/${user.tenantSlug}`} replace />;
    }
  }
  return <>{children}</>;
}
function SlugRedirectToLogin() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/${slug}/login`} replace />;
}

function TenantRoutes() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  // If the slug doesn't match the user's tenant, redirect to correct one
  if (user && slug !== user.tenantSlug) {
    return <Navigate to={`/${user.tenantSlug}`} replace />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Mesas /></ProtectedRoute>} />
        <Route path="/login" element={<Navigate to={`/${slug}`} replace />} />
        <Route path="/pdv" element={<ProtectedRoute><PDV /></ProtectedRoute>} />
        <Route path="/pedidos" element={<ProtectedRoute><Pedidos /></ProtectedRoute>} />
        <Route path="/entregas" element={<ProtectedRoute><Entregas /></ProtectedRoute>} />
        <Route path="/caixa" element={<ProtectedRoute><Caixa /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute adminOnly permissionKey="manage_customers"><Clientes /></ProtectedRoute>} />
        <Route path="/produtos" element={<ProtectedRoute adminOnly permissionKey="manage_products"><Produtos /></ProtectedRoute>} />
        <Route path="/estoque" element={<ProtectedRoute adminOnly permissionKey="manage_stock"><Estoque /></ProtectedRoute>} />
        <Route path="/relatorios" element={<ProtectedRoute adminOnly><Relatorios /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute superadminOnly><SuperAdmin /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/:slug/login" element={<Login />} />
        <Route path="/:slug/*" element={<SlugRedirectToLogin />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={`/${user.tenantSlug}`} replace />} />
      <Route path="/:slug/*" element={<TenantRoutes />} />
      <Route path="/" element={<Navigate to={`/${user.tenantSlug}`} replace />} />
      <Route path="*" element={<Navigate to={`/${user.tenantSlug}`} replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
