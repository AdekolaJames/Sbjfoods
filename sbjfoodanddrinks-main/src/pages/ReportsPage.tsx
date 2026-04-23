import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches } from '@/hooks/useBranches';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { DollarSign, TrendingUp, ShoppingCart, Users, AlertCircle, TrendingDown, Wallet, Receipt } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useExpenses } from '@/hooks/useExpenses';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function ReportsPage() {
  const { branchId } = useAuth();
  const { data: branches } = useBranches();
  const [days, setDays] = useState('7');
  const [selectedBranch, setSelectedBranch] = useState<string>('current');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const activeBranch = selectedBranch === 'all' ? null : selectedBranch === 'current' ? branchId : selectedBranch;

  const dateFrom = useMemo(() => {
    if (useCustom && customFrom) return startOfDay(new Date(customFrom)).toISOString();
    return startOfDay(subDays(new Date(), Number(days))).toISOString();
  }, [days, useCustom, customFrom]);
  const dateTo = useMemo(() => {
    if (useCustom && customTo) return endOfDay(new Date(customTo)).toISOString();
    return endOfDay(new Date()).toISOString();
  }, [useCustom, customTo]);

  const expenseDateFrom = dateFrom.slice(0, 10);
  const expenseDateTo = dateTo.slice(0, 10);

  // Orders (paid only)
  const { data: orders } = useQuery({
    queryKey: ['report-orders', activeBranch, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase.from('orders').select('*, order_items(*, order_item_addons(*)), payments(*)')
        .gte('created_at', dateFrom).lte('created_at', dateTo)
        .eq('payment_status', 'paid');
      if (activeBranch) q = q.eq('branch_id', activeBranch);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Cancelled / refunded for staff accountability
  const { data: badOrders } = useQuery({
    queryKey: ['report-bad-orders', activeBranch, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase.from('orders').select('id, cashier_id, status, payment_status, total, discount_amount, created_at, branch_id')
        .gte('created_at', dateFrom).lte('created_at', dateTo)
        .or('status.eq.cancelled,payment_status.eq.refunded');
      if (activeBranch) q = q.eq('branch_id', activeBranch);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['report-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Recipe ingredients with current cost (using stock_items.unit_cost as latest cost)
  const { data: recipeData } = useQuery({
    queryKey: ['report-recipes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('recipe_ingredients').select('*, stock_items(unit_cost, conversion_rate, base_unit, sub_unit)');
      if (error) throw error;
      return data || [];
    },
  });

  // Waste / loss movements
  const { data: wasteMovements } = useQuery({
    queryKey: ['report-waste', activeBranch, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase.from('stock_movements').select('*, stock_items(name, unit_cost)')
        .gte('created_at', dateFrom).lte('created_at', dateTo)
        .in('action', ['waste', 'remove']);
      if (activeBranch) q = q.eq('branch_id', activeBranch);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: expenses } = useExpenses(activeBranch, expenseDateFrom, expenseDateTo);

  const stats = useMemo(() => {
    if (!orders) return null;

    const totalSales = orders.reduce((s, o) => s + Number(o.total), 0);
    const orderCount = orders.length;
    const avgOrder = orderCount ? totalSales / orderCount : 0;

    // Daily sales
    const dayMap: Record<string, number> = {};
    orders.forEach(o => {
      const day = format(new Date(o.created_at), 'MMM dd');
      dayMap[day] = (dayMap[day] || 0) + Number(o.total);
    });
    const dailySales = Object.entries(dayMap).map(([date, amount]) => ({ date, amount: Math.round(amount) }));

    // Payment breakdown
    const payMap: Record<string, number> = {};
    orders.forEach(o => {
      ((o as any).payments || []).forEach((p: any) => {
        payMap[p.method] = (payMap[p.method] || 0) + Number(p.amount);
      });
    });
    const paymentBreakdown = Object.entries(payMap).map(([method, amount]) => ({ method, amount: Math.round(amount) }));

    // Top items
    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    orders.forEach(o => {
      ((o as any).order_items || []).forEach((oi: any) => {
        if (!itemMap[oi.item_name]) itemMap[oi.item_name] = { name: oi.item_name, qty: 0, revenue: 0 };
        itemMap[oi.item_name].qty += oi.quantity;
        itemMap[oi.item_name].revenue += Number(oi.total_price);
      });
    });
    const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10);

    // Staff performance
    const staffMap: Record<string, { name: string; orders: number; revenue: number }> = {};
    orders.forEach(o => {
      const profile = profiles?.find(p => p.user_id === o.cashier_id);
      const name = profile?.full_name || 'Unknown';
      if (!staffMap[o.cashier_id]) staffMap[o.cashier_id] = { name, orders: 0, revenue: 0 };
      staffMap[o.cashier_id].orders++;
      staffMap[o.cashier_id].revenue += Number(o.total);
    });
    const staffPerformance = Object.values(staffMap).sort((a, b) => b.revenue - a.revenue);

    // COGS — uses actual stock unit_cost. If sub_unit conversion exists, divide cost accordingly.
    const recipeCostMap: Record<string, number> = {};
    if (recipeData) {
      for (const r of recipeData) {
        const si = (r as any).stock_items;
        const baseCost = Number(si?.unit_cost || 0);
        const conversionRate = Number(si?.conversion_rate || 1);
        // If recipe unit equals sub_unit, cost per recipe-unit = baseCost / conversionRate.
        // Otherwise treat recipe unit as base unit.
        const recipeUnit = (r.unit || '').toLowerCase();
        const subUnit = (si?.sub_unit || '').toLowerCase();
        const costPerRecipeUnit = subUnit && recipeUnit === subUnit
          ? baseCost / Math.max(conversionRate, 1)
          : baseCost;
        recipeCostMap[r.menu_item_id] = (recipeCostMap[r.menu_item_id] || 0) + costPerRecipeUnit * Number(r.quantity_needed);
      }
    }

    let cogs = 0;
    orders.forEach(o => {
      ((o as any).order_items || []).forEach((oi: any) => {
        if (oi.menu_item_id && recipeCostMap[oi.menu_item_id]) {
          cogs += recipeCostMap[oi.menu_item_id] * oi.quantity;
        }
      });
    });

    const totalDiscounts = orders.reduce((s, o) => s + Number(o.discount_amount || 0), 0);

    let wasteCost = 0;
    if (wasteMovements) {
      wasteMovements.forEach(m => {
        wasteCost += Number(m.quantity) * Number((m as any).stock_items?.unit_cost || 0);
      });
    }

    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
    const expensesByCategory: Record<string, number> = {};
    (expenses || []).forEach(e => {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount);
    });

    const grossProfit = totalSales - cogs;
    const netProfit = grossProfit - totalExpenses - wasteCost - totalDiscounts;
    const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

    // Daily P&L trend
    const dayProfitMap: Record<string, { revenue: number; cost: number }> = {};
    orders.forEach(o => {
      const day = format(new Date(o.created_at), 'MMM dd');
      if (!dayProfitMap[day]) dayProfitMap[day] = { revenue: 0, cost: 0 };
      dayProfitMap[day].revenue += Number(o.total);
      ((o as any).order_items || []).forEach((oi: any) => {
        if (oi.menu_item_id && recipeCostMap[oi.menu_item_id]) {
          dayProfitMap[day].cost += recipeCostMap[oi.menu_item_id] * oi.quantity;
        }
      });
    });
    const profitTrend = Object.entries(dayProfitMap).map(([date, { revenue, cost }]) => ({
      date, revenue: Math.round(revenue), cost: Math.round(cost), profit: Math.round(revenue - cost),
    }));

    // Cash flow
    const cashIn = payMap['cash'] || 0;
    const transferIn = payMap['transfer'] || 0;
    const posIn = payMap['pos'] || payMap['card'] || 0;
    const otherIn = Object.entries(payMap)
      .filter(([m]) => !['cash', 'transfer', 'pos', 'card'].includes(m))
      .reduce((s, [, a]) => s + a, 0);
    const totalIn = cashIn + transferIn + posIn + otherIn;
    const cashBalance = totalIn - totalExpenses;

    // Staff accountability — discounts + cancellations + refunds
    const staffAccount: Record<string, { name: string; discounts: number; cancelled: number; refunded: number }> = {};
    orders.forEach(o => {
      const id = o.cashier_id;
      if (!staffAccount[id]) {
        const p = profiles?.find(p => p.user_id === id);
        staffAccount[id] = { name: p?.full_name || 'Unknown', discounts: 0, cancelled: 0, refunded: 0 };
      }
      staffAccount[id].discounts += Number(o.discount_amount || 0);
    });
    (badOrders || []).forEach(o => {
      const id = o.cashier_id;
      if (!staffAccount[id]) {
        const p = profiles?.find(p => p.user_id === id);
        staffAccount[id] = { name: p?.full_name || 'Unknown', discounts: 0, cancelled: 0, refunded: 0 };
      }
      if (o.status === 'cancelled') staffAccount[id].cancelled += 1;
      if (o.payment_status === 'refunded') staffAccount[id].refunded += 1;
    });
    const accountability = Object.values(staffAccount)
      .filter(s => s.discounts > 0 || s.cancelled > 0 || s.refunded > 0)
      .sort((a, b) => (b.discounts + b.cancelled * 1000 + b.refunded * 1000) - (a.discounts + a.cancelled * 1000 + a.refunded * 1000));

    return {
      totalSales, orderCount, avgOrder, dailySales, paymentBreakdown, topItems, staffPerformance,
      cogs, grossProfit, netProfit, profitMargin, totalDiscounts, wasteCost, profitTrend,
      totalExpenses, expensesByCategory,
      cashFlow: { cashIn, transferIn, posIn, otherIn, totalIn, totalOut: totalExpenses, cashBalance },
      accountability,
    };
  }, [orders, profiles, recipeData, wasteMovements, expenses, badOrders]);

  const isEmpty = !stats || stats.orderCount === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Reports</h1>
          <p className="text-muted-foreground">Sales, profitability, cash flow & staff accountability</p>
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Branch</SelectItem>
              <SelectItem value="all">All Branches</SelectItem>
              {branches?.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={useCustom ? 'custom' : days} onValueChange={(v) => {
            if (v === 'custom') setUseCustom(true);
            else { setUseCustom(false); setDays(v); }
          }}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {useCustom && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-[140px]" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-[140px]" />
              </div>
            </>
          )}
        </div>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">No sales data yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Complete your first order to start analytics.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Sales', value: `₦${stats!.totalSales.toLocaleString()}`, icon: DollarSign },
              { label: 'Orders', value: String(stats!.orderCount), icon: ShoppingCart },
              { label: 'Avg Order', value: `₦${Math.round(stats!.avgOrder).toLocaleString()}`, icon: TrendingUp },
              { label: 'Staff Active', value: String(stats!.staffPerformance.length), icon: Users },
            ].map(card => (
              <Card key={card.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10"><card.icon className="h-5 w-5 text-primary" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                      <p className="text-xl font-bold">{card.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* P&L Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Revenue', value: `₦${stats!.totalSales.toLocaleString()}`, color: 'text-primary' },
              { label: 'COGS', value: `₦${Math.round(stats!.cogs).toLocaleString()}`, color: 'text-muted-foreground' },
              { label: 'Gross Profit', value: `₦${Math.round(stats!.grossProfit).toLocaleString()}`, color: stats!.grossProfit >= 0 ? 'text-green-500' : 'text-destructive' },
              { label: 'Expenses', value: `₦${Math.round(stats!.totalExpenses).toLocaleString()}`, color: 'text-destructive' },
              { label: 'Wastage', value: `₦${Math.round(stats!.wasteCost).toLocaleString()}`, color: 'text-destructive' },
              { label: 'Discounts', value: `₦${Math.round(stats!.totalDiscounts).toLocaleString()}`, color: 'text-destructive' },
              { label: 'Net Profit', value: `₦${Math.round(stats!.netProfit).toLocaleString()}`, color: stats!.netProfit >= 0 ? 'text-green-500' : 'text-destructive' },
              { label: 'Margin', value: `${stats!.profitMargin.toFixed(1)}%`, color: stats!.profitMargin >= 0 ? 'text-green-500' : 'text-destructive' },
            ].map(card => (
              <Card key={card.label}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="sales">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="sales">Daily Sales</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="items">Best Sellers</TabsTrigger>
              <TabsTrigger value="staff">Staff</TabsTrigger>
              <TabsTrigger value="profit">P&L Trend</TabsTrigger>
              <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
              <TabsTrigger value="losses">Losses</TabsTrigger>
              <TabsTrigger value="accountability">Accountability</TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <Card>
                <CardHeader><CardTitle>Daily Sales</CardTitle></CardHeader>
                <CardContent>
                  {stats!.dailySales.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats!.dailySales}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, 'Sales']} />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">No sales data for this period</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments">
              <Card>
                <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
                <CardContent>
                  {stats!.paymentBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={stats!.paymentBreakdown} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={100} label={({ method, amount }: any) => `${method}: ₦${amount.toLocaleString()}`}>
                          {stats!.paymentBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Legend />
                        <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">No payment data</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="items">
              <Card>
                <CardHeader><CardTitle>Best Selling Items</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats!.topItems.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className="w-7 h-7 flex items-center justify-center rounded-full">{i + 1}</Badge>
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.qty} sold</p>
                          </div>
                        </div>
                        <p className="font-bold text-primary">₦{Math.round(item.revenue).toLocaleString()}</p>
                      </div>
                    ))}
                    {stats!.topItems.length === 0 && <p className="text-center text-muted-foreground py-8">No data</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="staff">
              <Card>
                <CardHeader><CardTitle>Staff Performance</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats!.staffPerformance.map((staff, i) => (
                      <div key={staff.name} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className="w-7 h-7 flex items-center justify-center rounded-full">{i + 1}</Badge>
                          <div>
                            <p className="font-medium text-sm">{staff.name}</p>
                            <p className="text-xs text-muted-foreground">{staff.orders} orders</p>
                          </div>
                        </div>
                        <p className="font-bold text-primary">₦{Math.round(staff.revenue).toLocaleString()}</p>
                      </div>
                    ))}
                    {stats!.staffPerformance.length === 0 && <p className="text-center text-muted-foreground py-8">No data</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profit">
              <Card>
                <CardHeader><CardTitle>Profit Trend</CardTitle></CardHeader>
                <CardContent>
                  {stats!.profitTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={stats!.profitTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip formatter={(v: number, name: string) => [`₦${v.toLocaleString()}`, name.charAt(0).toUpperCase() + name.slice(1)]} />
                        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} dot={false} />
                        <Legend />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">No profit data</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cashflow">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Cash Flow</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <p className="text-xs uppercase text-muted-foreground tracking-wider">Cash In</p>
                      <FlowRow label="Cash payments" value={stats!.cashFlow.cashIn} />
                      <FlowRow label="Transfers" value={stats!.cashFlow.transferIn} />
                      <FlowRow label="POS / Card" value={stats!.cashFlow.posIn} />
                      <FlowRow label="Other methods" value={stats!.cashFlow.otherIn} />
                      <div className="border-t border-border pt-2">
                        <FlowRow label="Total In" value={stats!.cashFlow.totalIn} bold />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase text-muted-foreground tracking-wider">Cash Out</p>
                      <FlowRow label="Operating expenses" value={stats!.cashFlow.totalOut} />
                      <div className="border-t border-border pt-2">
                        <FlowRow label="Total Out" value={stats!.cashFlow.totalOut} bold />
                      </div>
                      <div className="border-t border-border pt-2 mt-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5">
                          <span className="font-medium">Net Cash Balance</span>
                          <span className={`font-bold text-lg ${stats!.cashFlow.cashBalance >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                            ₦{Math.round(stats!.cashFlow.cashBalance).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="losses">
              <Card>
                <CardHeader><CardTitle>Loss & Expense Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Discounts Given</span>
                      </div>
                      <span className="font-bold text-destructive">₦{Math.round(stats!.totalDiscounts).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Waste / Damaged / Adjustments</span>
                      </div>
                      <span className="font-bold text-destructive">₦{Math.round(stats!.wasteCost).toLocaleString()}</span>
                    </div>
                    {Object.entries(stats!.expensesByCategory).map(([cat, amt]) => (
                      <div key={cat} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm capitalize">Expense: {cat}</span>
                        </div>
                        <span className="font-bold text-destructive">₦{Math.round(amt).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <span className="text-sm font-medium">Total Losses + Expenses</span>
                      <span className="font-bold text-destructive">
                        ₦{Math.round(stats!.totalDiscounts + stats!.wasteCost + stats!.totalExpenses).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="accountability">
              <Card>
                <CardHeader>
                  <CardTitle>Staff Accountability</CardTitle>
                  <p className="text-xs text-muted-foreground">Discounts given, cancelled & refunded orders per staff member</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats!.accountability.map((s, i) => (
                      <div key={i} className="p-3 bg-secondary rounded-lg flex items-center justify-between flex-wrap gap-2">
                        <p className="font-medium text-sm">{s.name}</p>
                        <div className="flex gap-2 text-xs">
                          {s.discounts > 0 && (
                            <Badge variant="outline" className="text-destructive">
                              ₦{Math.round(s.discounts).toLocaleString()} discount
                            </Badge>
                          )}
                          {s.cancelled > 0 && (
                            <Badge variant="outline" className="text-destructive">
                              {s.cancelled} cancelled
                            </Badge>
                          )}
                          {s.refunded > 0 && (
                            <Badge variant="outline" className="text-destructive">
                              {s.refunded} refunded
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {stats!.accountability.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No discounts, cancellations, or refunds in this period</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function FlowRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={bold ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
      <span className={bold ? 'font-bold' : ''}>₦{Math.round(value).toLocaleString()}</span>
    </div>
  );
}
