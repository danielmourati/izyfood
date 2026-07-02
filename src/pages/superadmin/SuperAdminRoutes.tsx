import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SuperAdminLayout } from './SuperAdminLayout';
import { SuperAdminContent } from '@/pages/SuperAdmin';
import { PlanosPage } from './PlanosPage';
import { AuditoriaPage } from './AuditoriaPage';
import { SistemaPage } from './SistemaPage';

/**
 * Wrapper: reuses SuperAdminContent but pins it to a single internal tab
 * so each sidebar route shows only the relevant panel.
 */
function ContentPage({ initialTab }: { initialTab: 'dashboard' | 'tenants' | 'usuarios' | 'criar' }) {
  return (
    <div className="p-4 md:p-6">
      <SuperAdminContent key={initialTab} initialTab={initialTab} withHeader={false} />
    </div>
  );
}

export function SuperAdminRoutes() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'superadmin') return <Navigate to={`/${user.tenantSlug}`} replace />;

  return (
    <SuperAdminLayout>
      <Routes>
        <Route path="/" element={<ContentPage initialTab="dashboard" />} />
        <Route path="/tenants" element={<ContentPage initialTab="tenants" />} />
        <Route path="/tenants/novo" element={<ContentPage initialTab="criar" />} />
        <Route path="/usuarios" element={<ContentPage initialTab="usuarios" />} />
        <Route path="/planos" element={<PlanosPage />} />
        <Route path="/auditoria" element={<AuditoriaPage />} />
        <Route path="/sistema" element={<SistemaPage />} />
        <Route path="*" element={<Navigate to="/superadmin" replace />} />
      </Routes>
    </SuperAdminLayout>
  );
}
