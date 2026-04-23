import {
  LayoutDashboard, ShoppingCart, ClipboardList,
  UtensilsCrossed, Tags, Package, BarChart3, Users, Building2,
  Settings, Receipt, LogOut, Ruler, Wallet, UserCircle, Gauge
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { getPermittedRoutes } from '@/types/roles';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, ShoppingCart, ClipboardList,
  UtensilsCrossed, Tags, Package, BarChart3, Users, Building2,
  Settings, Receipt, Ruler, Wallet, UserCircle, Gauge,
};

export function AppSidebar() {
  const { role, profile, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const routes = getPermittedRoutes(role);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm font-display">SBJ</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-sidebar-foreground truncate font-display">SBJ Foods & Drinks</p>
              <p className="text-xs text-muted-foreground capitalize">{role?.replace('_', ' ') || 'Loading...'}</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {routes.map((item) => {
                const Icon = ICON_MAP[item.icon] || LayoutDashboard;
                return (
                  <SidebarMenuItem key={item.route}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.route}
                        end
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-primary font-medium"
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && profile && (
          <div className="mb-2 px-1">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
