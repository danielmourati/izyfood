import {
  ShoppingCart, Grid3X3, ClipboardList, Users, Package, BarChart3, LogOut, Truck, UtensilsCrossed, Settings
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

const allItems = [
  { title: 'Mesas', url: '/', icon: Grid3X3, adminOnly: false },
  { title: 'PDV', url: '/pdv', icon: ShoppingCart, adminOnly: false },
  { title: 'Pedidos', url: '/pedidos', icon: ClipboardList, adminOnly: false },
  { title: 'Delivery', url: '/entregas', icon: Truck, adminOnly: false },
  { title: 'Clientes', url: '/clientes', icon: Users, adminOnly: true },
  { title: 'Produtos', url: '/produtos', icon: UtensilsCrossed, adminOnly: true },
  { title: 'Estoque', url: '/estoque', icon: Package, adminOnly: true },
  { title: 'Relatórios', url: '/relatorios', icon: BarChart3, adminOnly: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user, logout, isAdmin } = useAuth();

  const items = allItems.filter(i => isAdmin || !i.adminOnly);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar flex flex-col">
        {/* Avatar / User header */}
        <div className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground font-bold text-sm shrink-0 ring-2 ring-sidebar-primary/30">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-semibold text-sidebar-foreground text-sm leading-tight truncate">{user?.name}</p>
              <p className="text-[11px] text-sidebar-foreground/50 truncate">{user?.email}</p>
            </div>
          )}
        </div>

        <Separator className="bg-sidebar-border mx-3 w-auto" />

        {/* Navigation */}
        <SidebarGroup className="flex-1 py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-2 space-y-0.5">
        <ThemeToggle collapsed={collapsed} />

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/configuracoes"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
              >
                <Settings className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <button
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full"
          onClick={logout}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
