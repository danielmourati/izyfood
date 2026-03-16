import {
  ShoppingCart, Grid3X3, ClipboardList, Users, Package, BarChart3, LogOut, Truck
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const allItems = [
  { title: 'Mesas', url: '/', icon: Grid3X3, adminOnly: false },
  { title: 'PDV', url: '/pdv', icon: ShoppingCart, adminOnly: false },
  { title: 'Pedidos', url: '/pedidos', icon: ClipboardList, adminOnly: false },
  { title: 'Delivery', url: '/entregas', icon: Truck, adminOnly: false },
  { title: 'Clientes', url: '/clientes', icon: Users, adminOnly: true },
  { title: 'Estoque', url: '/estoque', icon: Package, adminOnly: true },
  { title: 'Relatórios', url: '/relatorios', icon: BarChart3, adminOnly: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user, logout, isAdmin } = useAuth();

  const items = allItems.filter(i => isAdmin || !i.adminOnly);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar">
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <img src="/logo.png" alt="Carnaúba" className="h-10 w-10 rounded-lg object-contain bg-white/10 p-1" />
          {!collapsed && (
            <div>
              <h2 className="font-bold text-sidebar-foreground text-sm leading-tight">Carnaúba</h2>
              <p className="text-[10px] text-sidebar-foreground/60">{user?.name}</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
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

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent gap-3"
          onClick={logout}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
