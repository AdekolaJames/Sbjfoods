import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Users, Building2, UtensilsCrossed } from 'lucide-react';

export default function Dashboard() {
  const { user, branch, signOut } = useAuth();
const branchId = branch?.id;

  console.log("BRANCH ID:", branchId);

  // TODAY FILTER
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // ORDERS (branch + today)
  const { data: todayOrders = 0 } = useQuery({
    queryKey: ['orders', branchId],
    enabled: !!branchId,
    queryFn: async () => {

  if (!branchId) return 0;
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .gte('created_at', todayStart.toISOString());

      if (error) {
        console.log('orders error:', error.message);
        return 0;
      }

      return count || 0;
    },
  });

  // MENU (branch scoped)
  const { data: menuCount = 0 } = useQuery({
    queryKey: ['menu', branchId],
    enabled: !!branchId,
    queryFn: async () => {

      if (!branchId) return 0;
      const { count, error } = await supabase
        .from('menu_items')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .eq('is_available', true);

      if (error) {
        console.log('menu_items error:', error.message);
        return 0;
      }

      return count || 0;
    },
  });

  // STAFF (branch scoped)
  const { data: staffCount = 0 } = useQuery({
    queryKey: ['staff', branchId],
    enabled: !!branchId,
    queryFn: async () => {

      if (!branchId) return 0;
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .eq('is_active', true);

      if (error) {
        console.log('profiles error:', error.message);
        return 0;
      }

      return count || 0;
    },
  });

  // BRANCHES (global, admin only)
  const { data: branchCount = 0 } = useQuery({
    queryKey: ['branches'],
    enabled: !!branchId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('branches')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (error) {
        console.log('branches error:', error.message);
        return 0;
      }

      return count || 0;
    },
  });

  return (
  <div className="space-y-6">

    <button
      onClick={signOut}
      className="px-4 py-2 bg-red-500 text-white rounded"
    >
      Logout
    </button>
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold">
          Welcome, {user?.email || 'Admin'}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's an overview of your branch activity today
        </p>
      </div>

      {/* STATS GRID */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        <Card>
          <CardHeader className="flex justify-between">
            <CardTitle className="text-sm">Today's Orders</CardTitle>
            <ShoppingCart />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayOrders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex justify-between">
            <CardTitle className="text-sm">Menu Items</CardTitle>
            <UtensilsCrossed />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{menuCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex justify-between">
            <CardTitle className="text-sm">Active Staff</CardTitle>
            <Users />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{staffCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex justify-between">
            <CardTitle className="text-sm">Branches</CardTitle>
            <Building2 />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{branchCount}</p>
          </CardContent>
        </Card>

      </div>

      {/* FOOTER CARD */}
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          System ready. You are working in branch: <b>{branchId}</b>
        </CardContent>
      </Card>

    </div>
  );
}