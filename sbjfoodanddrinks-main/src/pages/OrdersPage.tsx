import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useBranches } from '@/hooks/useBranches';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Ban, RotateCcw, Receipt as ReceiptIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export default function OrdersPage() {
  const { branchId, role } = useAuth();
  const { data: branches } = useBranches();
  const [tab, setTab] = useState<'all' | 'pending_approval' | 'held' | 'completed' | 'cancelled'>('all');
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>(role === 'admin' ? 'all' : branchId || 'all');
  const updateStatus = useUpdateOrderStatus();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const effectiveBranch = branchFilter === 'all' && role === 'admin' ? null : (branchFilter === 'all' ? branchId : branchFilter);
  const { data: orders, isLoading } = useOrders(effectiveBranch);

  const filtered = (orders || []).filter(o => {
    if (tab === 'held' && !o.is_held) return false;
    if (tab === 'pending_approval' && o.status !== ('pending_approval' as any)) return false;
    if (tab === 'completed' && o.status !== 'completed') return false;
    if (tab === 'cancelled' && o.status !== 'cancelled') return false;
    if (search && !o.order_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendingApprovalCount = (orders || []).filter(o => o.status === ('pending_approval' as any)).length;

  const approveOrder = async (id: string) => {
    try {
      await supabase.from('orders').update({
        status: 'pending' as any,
        approved_at: new Date().toISOString(),
      } as any).eq('id', id);
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Approved — awaiting payment at the counter');
    } catch (e: any) { toast.error(e.message); }
  };

  const cancelOrder = async (id: string) => {
    try {
      await supabase.from('orders').update({ status: 'cancelled', is_held: false }).eq('id', id);
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order cancelled');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold font-display">Orders</h1>
          <p className="text-muted-foreground mt-1">All orders, held drafts and history</p>
        </div>
        {role === 'admin' && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending_approval" className="gap-1">
            Pending Approval
            {pendingApprovalCount > 0 && <Badge variant="destructive" className="h-4 px-1 text-xs">{pendingApprovalCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="held">Held</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by order number..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No orders</TableCell></TableRow>
              ) : (
                filtered.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {(o as any).source === 'shop' ? '🛒 Shop' : 'POS'}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge variant="outline">{o.order_type.replace('_', ' ')}</Badge></TableCell>
                    <TableCell>
                      {o.is_held ? (
                        <Badge className="bg-warning/20 text-warning">held</Badge>
                      ) : o.status === ('pending_approval' as any) ? (
                        <Badge className="bg-warning/20 text-warning">pending approval</Badge>
                      ) : (
                        <Badge variant={o.status === 'completed' ? 'default' : o.status === 'cancelled' ? 'destructive' : 'secondary'}>
                          {o.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{o.customer_name || '—'}</TableCell>
                    <TableCell className="text-sm">{(o as any).order_items?.length || 0}</TableCell>
                    <TableCell className="font-semibold">₦{Number(o.total).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {o.status === ('pending_approval' as any) && (
                        <Button size="sm" onClick={() => approveOrder(o.id)}>
                          Approve
                        </Button>
                      )}
                      {o.is_held && (
                        <Button variant="outline" size="sm" onClick={() => navigate('/pos')}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Resume
                        </Button>
                      )}
                      {o.status === 'completed' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View Receipt"
                          onClick={() => navigate(`/receipts?order=${o.id}`)}>
                          <ReceiptIcon className="h-4 w-4" />
                        </Button>
                      )}
                      {o.status !== 'cancelled' && o.status !== 'completed' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Ban className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel order {o.order_number}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This marks the order as cancelled. It will not affect reports or inventory.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground"
                                onClick={() => cancelOrder(o.id)}
                              >Cancel Order</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
