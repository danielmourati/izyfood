import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Building2, Users, CreditCard, FileText, Settings2, LogOut, ArrowLeft, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HeaderClock } from '@/components/HeaderClock';
import degustLogoHorizontal from '@/assets/degust-logo-horizontal.png.asset.json';

const items = [
  { to: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/superadmin/tenants', label: 'Tenants', icon: Building2 },
  { to: '/superadmin/usuarios', label: 'Usuários', icon: Users },
  { to: '/superadmin/planos', label: 'Planos', icon: CreditCard },
  { to: '/superadmin/auditoria', label: 'Auditoria', icon: FileText },
  { to: '/superadmin/sistema', label: 'Sistema', icon: Settings2 },
];

export function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'SA';

  return (
    <div className="h-[100dvh] flex w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="p-5 border-b border-border">
          <div className="flex flex-col gap-3">
            <img src={degustLogoHorizontal.url} alt="Degust" className="h-9 object-contain self-start" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              <p className="text-[10px] uppercase tracking-wider font-semibold">Super Admin Console</p>
            </div>
            <HeaderClock />

          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3 space-y-2">
          {user?.tenantSlug && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => navigate(`/${user.tenantSlug}`)}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Tenant
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 w-full p-2 outline-none hover:bg-muted rounded-lg transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground leading-tight truncate">{user?.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem disabled>{user?.email}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="md:hidden flex items-center gap-2 h-14 border-b border-border bg-card px-4 shrink-0">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-heading font-bold">Super Admin</span>
          <HeaderClock className="ml-auto" />
          {user?.tenantSlug && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => navigate(`/${user.tenantSlug}`)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voltar ao tenant</TooltipContent>
            </Tooltip>
          )}
        </header>


        <div className="md:hidden flex gap-1 overflow-x-auto p-2 border-b border-border bg-card shrink-0">
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
