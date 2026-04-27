// Note: 'kitchen' kept in the type union for backward DB enum compatibility,
// but Kitchen module has been removed from the UI/navigation as the system now
// behaves as a fast retail/eatery POS without kitchen workflow.
export type AppRole = 'admin' | 'cashier' | 'kitchen' | 'waiter' | 'branch_manager';

export interface Permission {
  route: string;
  label: string;
  icon: string;
  roles: AppRole[];
}

// Central route-to-role mapping
export const ROUTE_PERMISSIONS: Permission[] = [
  { route: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', roles: ['admin'] },
  { route: '/branch-dashboard', label: 'Branch Dashboard', icon: 'Gauge', roles: ['admin', 'branch_manager'] },
  { route: '/pos', label: 'POS', icon: 'ShoppingCart', roles: ['admin', 'cashier', 'waiter'] },
  { route: '/orders', label: 'Orders', icon: 'ClipboardList', roles: ['admin', 'cashier', 'waiter', 'branch_manager'] },
  { route: '/menu', label: 'Menu', icon: 'UtensilsCrossed', roles: ['admin', 'branch_manager'] },
  { route: '/categories', label: 'Categories', icon: 'Tags', roles: ['admin', 'branch_manager'] },
  { route: '/inventory', label: 'Inventory', icon: 'Package', roles: ['admin', 'branch_manager'] },
  { route: '/units', label: 'Units', icon: 'Ruler', roles: ['admin'] },
  { route: '/expenses', label: 'Expenses', icon: 'Wallet', roles: ['admin', 'branch_manager'] },
  { route: '/reports', label: 'Reports', icon: 'BarChart3', roles: ['admin', 'branch_manager'] },
  { route: '/staff', label: 'Staff', icon: 'Users', roles: ['admin'] },
  { route: '/customers', label: 'Customers', icon: 'UserCircle', roles: ['admin'] },
  { route: '/branches', label: 'Branches', icon: 'Building2', roles: ['admin'] },
  { route: '/settings', label: 'Settings', icon: 'Settings', roles: ['admin'] },
  { route: '/receipts', label: 'Receipts', icon: 'Receipt', roles: ['admin', 'cashier'] },
];

export function getPermittedRoutes(role: AppRole | null): Permission[] {
  if (!role) return [];
  return ROUTE_PERMISSIONS.filter(p => p.roles.includes(role));
}

export function canAccessRoute(role: AppRole | null, route: string): boolean {
  if (!role) return false;
  const permission = ROUTE_PERMISSIONS.find(p => p.route === route);
  if (!permission) return false;
  return permission.roles.includes(role);
}
