import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { isDesktopApp } from "@/lib/printer-desktop";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { useAttendantPermissions, AttendantPermissions } from "@/hooks/use-attendant-permissions";
import { Layout } from "@/components/Layout";
import Login from "./pages/Login";
import Balcao from "./pages/Balcao";
import Home from "./pages/Home";
import Mesas from "./pages/Mesas";
import Pedidos from "./pages/Pedidos";
import Clientes from "./pages/Clientes";
import Estoque from "./pages/Estoque";
import Categorias from "./pages/Categorias";
import Produtos from "./pages/Produtos";
import Relatorios from "./pages/Relatorios";
import Caixa from "./pages/Caixa";
import Configuracoes from "./pages/Configuracoes";
import { SuperAdminRoutes } from "./pages/superadmin/SuperAdminRoutes";
import DiagnosticoSync from "./pages/DiagnosticoSync";
import NotFound from "./pages/NotFound";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TenantGate } from "@/components/TenantGate";

const queryClient = new QueryClient();

type PermissionKey = keyof AttendantPermissions;

function ProtectedRoute({ children, adminOnly = false, superadminOnly = false, permissionKey }: { children: React.ReactNode; adminOnly?: boolean; superadminOnly?: boolean; permissionKey?: PermissionKey }) {
  const { user, isAdmin } = useAuth();
  const { permissions, loading: permsLoading } = useAttendantPermissions();
  if (!user) return <Navigate to="/login" replace />;
  if (superadminOnly && user.role !== 'superadmin') return <Navigate to={`/${user.tenantSlug}`} replace />;
  if (adminOnly && !isAdmin) {
    if (permsLoading) {
      return <AppSkeleton />;
    }
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

function SlugGate({ children }: { children: import("react").ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  return <TenantGate slug={slug}>{children}</TenantGate>;
}

function TenantStartPage() {
  return <Home />;
}

function TenantRoutes() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  // If the slug doesn't match the user's tenant (and not superadmin inspecting a tenant), redirect to correct one
  if (user && slug && slug !== user.tenantSlug && user.role !== 'superadmin') {
    if (user.id === 'demo-admin-id') {
      user.tenantSlug = slug;
    } else {
      return <Navigate to={`/${user.tenantSlug}`} replace />;
    }
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ProtectedRoute><TenantStartPage /></ProtectedRoute>} />
        <Route path="/mesas" element={<ProtectedRoute adminOnly permissionKey="manage_tables"><Mesas /></ProtectedRoute>} />
        <Route path="/login" element={<Navigate to={user?.role === 'superadmin' ? '/superadmin' : `/${slug}`} replace />} />
        <Route path="/balcao" element={<ProtectedRoute adminOnly permissionKey="use_counter"><Balcao /></ProtectedRoute>} />
        <Route path="/pdv" element={<Navigate to={`/${slug}`} replace />} />
        <Route path="/pedidos" element={<ProtectedRoute adminOnly permissionKey="view_orders_history"><Pedidos /></ProtectedRoute>} />
        <Route path="/caixa" element={<ProtectedRoute adminOnly permissionKey="view_cash_register"><Caixa /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute adminOnly permissionKey="manage_customers"><Clientes /></ProtectedRoute>} />
        <Route path="/categorias" element={<ProtectedRoute adminOnly permissionKey="manage_categories"><Categorias /></ProtectedRoute>} />
        <Route path="/produtos" element={<ProtectedRoute adminOnly permissionKey="manage_products"><Produtos /></ProtectedRoute>} />
        <Route path="/estoque" element={<ProtectedRoute adminOnly permissionKey="manage_stock"><Estoque /></ProtectedRoute>} />
        <Route path="/relatorios" element={<ProtectedRoute adminOnly permissionKey="view_reports"><Relatorios /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
        <Route path="/diagnostico-sync" element={<ProtectedRoute superadminOnly><DiagnosticoSync /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

function AppSkeleton() {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex w-64 flex-col border-r bg-card p-4 space-y-6">
        <div className="flex items-center gap-3 px-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="space-y-2 flex-1">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
        <div className="pt-4 border-t space-y-2">
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Skeleton */}
        <div className="h-16 border-b flex items-center justify-between px-6 bg-card">
          <Skeleton className="h-6 w-48" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>

        {/* Content Body Skeleton */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-80 md:col-span-2 rounded-xl" />
            <Skeleton className="h-80 md:col-span-1 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <AppSkeleton />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/:slug/login" element={<SlugGate><Login /></SlugGate>} />
        <Route path="/:slug/*" element={<SlugGate><SlugRedirectToLogin /></SlugGate>} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={user.role === 'superadmin' ? '/superadmin' : `/${user.tenantSlug}`} replace />} />
      <Route path="/:slug/login" element={<Navigate to={user.role === 'superadmin' ? '/superadmin' : `/${user.tenantSlug}`} replace />} />
      <Route path="/superadmin/*" element={<SuperAdminRoutes />} />
      <Route path="/:slug/*" element={<SlugGate><TenantRoutes /></SlugGate>} />
      <Route path="/" element={<Navigate to={user.role === 'superadmin' ? '/superadmin' : `/${user.tenantSlug}`} replace />} />
      <Route path="*" element={<Navigate to={user.role === 'superadmin' ? '/superadmin' : `/${user.tenantSlug}`} replace />} />
    </Routes>
  );
}

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const RouterComponent = isDesktopApp() || isFileProtocol ? HashRouter : BrowserRouter;

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="izyfood-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterComponent>
          <AuthProvider>
            <StoreProvider>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </StoreProvider>
          </AuthProvider>
        </RouterComponent>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
