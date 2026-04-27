import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches } from '@/hooks/useBranches';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  RefreshCw, ShoppingCart, DollarSign, TrendingUp, Users, AlertTriangle,
  Package, ClipboardList, BarChart3, Receipt as ReceiptIcon,
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function BranchDashboard() {
  const { branchId, role, profile } = useAuth();
  const { data: branches } = useBranches();
  const qc = useQueryClient();

  // Admin can switch branches; manager is locked to their assigned branch
  const [selectedBranch, setSelectedBranch] = useState<string>(branchId || '');
  const activeBranch = role === 'admin' ? selectedBranch || branchId : branchId;
  const branch = branches?.find(b => b.id === activeBranch);

  const [rangeDays, setRangeDays] = useState<'1' | '7' | '30'>('1');
  const dateFrom = useMemo(() =>
    startOfDay(rangeDays === '1' ? new Date() : subDays(new Date(), Number(rangeDays) - 1)).toISOString(),
    [rangeDays]);
  const dateTo = useMemo(() => endOfDay(new Date()).toISOString(), [rangeDays]);

  // ---- Paid orders for the period ----
  const { data: orders, isLoading } = useQuery({
    queryKey: ['branch-dash-orders', activeBranch, dateFrom, dateTo],
    enabled: !!activeBranch,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total, status, payment_status, created_at, cashier_id, order_items(item_name, quantity, total_price), payments(method, amount)')
        .eq('branch_id', activeBranch)
        .eq('payment_status', 'paid')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  // ---- Active (open) orders for monitoring ----
  const { data: activeOrders } = useQuery({
    queryKey: ['branch-dash-active', activeBranch],
    enabled: !!activeBranch,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at, customer_name')
        .eq('branch_id', activeBranch)
        .in('status', ['pending_approval', 'pending'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15_000,
  });

  // ---- Low stock ----
  const { data: lowStock } = useQuery({
    queryKey: ['branch-dash-lowstock', activeBranch],
    enabled: !!activeBranch,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_items')
        .select('id, name, quantity, low_stock_threshold, unit')
        .eq('branch_id', activeBranch)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).filter(s => Number(s.quantity) <= Number(s.low_stock_threshold));
    },
    refetchInterval: 60_000,
  });

  // ---- Staff names for performance lookup ----
  const { data: profiles } = useQuery({
    queryKey: ['branch-dash-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  // ---- Aggregations ----
  const stats = useMemo(() => {
    const list = orders || [];
    const totalSales = list.reduce((s, o) => s + Number(o.total), 0);
    const orderCount = list.length;
    const avgOrder = orderCount ? totalSales / orderCount : 0;

    const dayMap: Record<string, number> = {};
    const payMap: Record<string, number> = {};
    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    const staffMap: Record<string, { name: string; orders: number; revenue: number }> = {};
    const activeStaff = new Set<string>();

    list.forEach(o => {
      const day = format(new Date(o.created_at), rangeDays === '1' ? 'HH:00' : 'MMM dd');
      dayMap[day] = (dayMap[day] || 0) + Number(o.total);

      ((o as any).payments || []).forEach((p: any) => {
        payMap[p.method] = (payMap[p.method] || 0) + Number(p.amount);
      });

      ((o as any).order_items || []).forEach((oi: any) => {
        if (!itemMap[oi.item_name]) itemMap[oi.item_name] = { name: oi.item_name, qty: 0, revenue: 0 };
        itemMap[oi.item_name].qty += oi.quantity;
        itemMap[oi.item_name].revenue += Number(oi.total_price);
      });

      const sid = o.cashier_id;
      activeStaff.add(sid);
      const sname = profiles?.find(p => p.user_id === sid)?.full_name || 'Unknown';
      if (!staffMap[sid]) staffMap[sid] = { name: sname, orders: 0, revenue: 0 };
      staffMap[sid].orders++;
      staffMap[sid].revenue += Number(o.total);
    });

    return {
      totalSales,
      orderCount,
      avgOrder,
      activeStaffCount: activeStaff.size,
      sales: Object.entries(dayMap).map(([date, amount]) => ({ date, amount: Math.round(amount) })),
      payments: Object.entries(payMap).map(([method, amount]) => ({ method, amount: Math.round(amount) })),
      topItems: Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 5),
      staffPerf: Object.values(staffMap).sort((a, b) => b.revenue - a.revenue),
    };
  }, [orders, profiles, rangeDays]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['branch-dash-orders'] });
    qc.invalidateQueries({ queryKey: ['branch-dash-active'] });
    qc.invalidateQueries({ queryKey: ['branch-dash-lowstock'] });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending_approval: 'bg-warning/20 text-warning',
      pending: 'bg-secondary text-foreground',
    };
    return map[status] || 'bg-secondary';
  };

  if (!activeBranch) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        Select a branch to view its dashboard.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">{branch?.name || 'Branch Dashboard'}</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {profile?.full_name || 'Manager'} · Operational overview
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {role === 'admin' && (
            <Select value={selectedBranch || ''} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>
                {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={rangeDays} onValueChange={(v) => setRangeDays(v as any)}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Total Sales', value: `₦${stats.totalSales.toLocaleString()}`, icon: DollarSign, accent: 'text-primary' },
          { label: 'Orders', value: stats.orderCount.toString(), icon: ShoppingCart, accent: 'text-blue-400' },
          { label: 'Avg. Order', value: `₦${Math.round(stats.avgOrder).toLocaleString()}`, icon: TrendingUp, accent: 'text-green-400' },
          { label: 'Active Staff', value: stats.activeStaffCount.toString(), icon: Users, accent: 'text-amber-400' },
        ].map(card => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-lg md:text-2xl font-bold font-display mt-1 truncate">{card.value}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary shrink-0">
                  <card.icon className={`h-4 w-4 ${card.accent}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { to: '/pos', label: 'Open POS', icon: ShoppingCart },
          { to: '/orders', label: 'View Orders', icon: ClipboardList },
          { to: '/inventory', label: 'Inventory', icon: Package },
          { to: '/reports', label: 'Reports', icon: BarChart3 },
        ].map(a => (
          <Button key={a.to} asChild variant="outline" className="justify-start h-10">
            <Link to={a.to}><a.icon className="h-4 w-4 mr-2" />{a.label}</Link>
          </Button>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base font-display">Sales Trend</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {stats.sales.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.sales}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, 'Sales']} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState text="No sales for this period" />}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base font-display">Payment Breakdown</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {stats.payments.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.payments} dataKey="amount" nameKey="method" outerRadius={80} label>
                    {stats.payments.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState text="No payments yet" />}
          </CardContent>
        </Card>
      </div>

      {/* Best sellers + Staff perf */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base font-display">Best Sellers</CardTitle></CardHeader>
          <CardContent>
            {stats.topItems.length ? (
              <div className="space-y-2">
                {stats.topItems.map((it, i) => (
                  <div key={it.name} className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                      <span className="font-medium text-sm truncate">{it.name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-sm font-semibold">{it.qty} sold</div>
                      <div className="text-xs text-muted-foreground">₦{Math.round(it.revenue).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState text="No items sold yet" />}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base font-display">Staff Performance</CardTitle></CardHeader>
          <CardContent>
            {stats.staffPerf.length ? (
              <div className="space-y-2">
                {stats.staffPerf.map((s, i) => (
                  <div key={s.name + i} className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={i === 0 ? 'default' : 'outline'} className="text-xs shrink-0">#{i + 1}</Badge>
                      <span className="font-medium text-sm truncate">{s.name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-sm font-semibold">₦{Math.round(s.revenue).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{s.orders} orders</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState text="No staff activity yet" />}
          </CardContent>
        </Card>
      </div>

      {/* Active orders + Low stock + Recent activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-display">Active Orders</CardTitle>
            <Badge variant="secondary">{activeOrders?.length || 0}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px]">
              <div className="space-y-2">
                {(activeOrders || []).map(o => (
                  <div key={o.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/50 text-sm">
                    <div className="min-w-0">
                      <div className="font-mono text-xs">{o.order_number}</div>
                      {o.customer_name && <div className="text-xs text-muted-foreground truncate">{o.customer_name}</div>}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <Badge className={`${statusBadge(o.status)} text-xs`}>{String(o.status).replace('_', ' ')}</Badge>
                      <div className="text-xs text-muted-foreground mt-0.5">₦{Number(o.total).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
                {(activeOrders?.length || 0) === 0 && (
                  <EmptyState text="No active orders" />
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Low Stock Alerts
            </CardTitle>
            <Badge variant={lowStock?.length ? 'destructive' : 'secondary'}>{lowStock?.length || 0}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px]">
              <div className="space-y-2">
                {(lowStock || []).map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/50 text-sm">
                    <span className="font-medium truncate min-w-0">{s.name}</span>
                    <div className="text-right shrink-0 ml-3">
                      <span className="font-bold text-destructive">{Number(s.quantity)} {s.unit}</span>
                      <div className="text-xs text-muted-foreground">min {s.low_stock_threshold}</div>
                    </div>
                  </div>
                ))}
                {(lowStock?.length || 0) === 0 && <EmptyState text="All stock levels healthy" />}
              </div>
            </ScrollArea>
            {(lowStock?.length || 0) > 0 && (
              <Button asChild variant="outline" size="sm" className="w-full mt-3">
                <Link to="/inventory"><Package className="h-3 w-3 mr-1" /> Manage Inventory</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-base font-display flex items-center gap-2">
          <ReceiptIcon className="h-4 w-4 text-primary" /> Recent Paid Orders
        </CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-1">
              {(orders || []).slice(0, 15).map(o => (
                <div key={o.id} className="flex items-center justify-between text-xs p-2 rounded bg-secondary/30">
                  <div className="font-mono">{o.order_number}</div>
                  <div className="text-muted-foreground">{format(new Date(o.created_at), 'MMM dd · HH:mm')}</div>
                  <div className="font-semibold">₦{Number(o.total).toLocaleString()}</div>
                </div>
              ))}
              {!orders?.length && <EmptyState text="No paid orders yet" />}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground py-8">
      {text}
    </div>
  );
}
