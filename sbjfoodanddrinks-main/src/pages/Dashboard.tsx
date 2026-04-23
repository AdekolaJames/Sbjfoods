import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, ShoppingCart, Users, Building2, UtensilsCrossed, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const { profile, role } = useAuth();

  const { data: branchCount } = useQuery({
    queryKey: ['dashboard-branches'],
    queryFn: async () => {
      const { count } = await supabase.from('branches').select('*', { count: 'exact', head: true }).eq('is_active', true);
      return count || 0;
    },
  });

  const { data: staffCount } = useQuery({
    queryKey: ['dashboard-staff'],
    queryFn: async () => {
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true);
      return count || 0;
    },
  });

  const { data: menuCount } = useQuery({
    queryKey: ['dashboard-menu'],
    queryFn: async () => {
      const { count } = await supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('is_available', true);
      return count || 0;
    },
  });

  const { data: todayOrders } = useQuery({
    queryKey: ['dashboard-orders-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', today);
      return count || 0;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Welcome, {profile?.full_name || 'Admin'}</h1>
        <p className="text-muted-foreground mt-1">Here's an overview of your business today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-display">{todayOrders}</p>
            <p className="text-xs text-muted-foreground">Orders placed today</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Menu Items</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-display">{menuCount}</p>
            <p className="text-xs text-muted-foreground">Available items</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Staff</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-display">{staffCount}</p>
            <p className="text-xs text-muted-foreground">Staff members</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Branches</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-display">{branchCount}</p>
            <p className="text-xs text-muted-foreground">Active outlets</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">
            Start by adding menu items and categories, then create staff accounts to begin processing orders.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
