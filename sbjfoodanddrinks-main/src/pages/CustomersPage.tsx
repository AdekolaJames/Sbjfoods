import { useMemo, useState } from 'react';
import { useCustomers, useCustomerOrders } from '@/hooks/useCustomers';
import { useBranches } from '@/hooks/useBranches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Download, Loader2, UserCircle } from 'lucide-react';
import { toast } from 'sonner';

function toCSV(rows: Record<string, any>[], columns: { key: string; label: string }[]) {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const body = rows.map(r => columns.map(c => escape(r[c.key])).join(',')).join('\n');
  return header + '\n' + body;
}

export default function CustomersPage() {
  const { data: branches } = useBranches();
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const { data: customers, isLoading } = useCustomers(branchFilter === 'all' ? null : branchFilter);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'orders' | 'spend'>('recent');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = customers || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
      );
    }
    list = [...list];
    if (sortBy === 'recent') {
      list.sort((a, b) => (b.last_order_date || '').localeCompare(a.last_order_date || ''));
    } else if (sortBy === 'orders') {
      list.sort((a, b) => (b.total_orders || 0) - (a.total_orders || 0));
    } else {
      list.sort((a, b) => Number(b.total_spent || 0) - Number(a.total_spent || 0));
    }
    return list;
  }, [customers, search, sortBy]);

  const exportCSV = () => {
    if (!filtered.length) { toast.error('No customers to export'); return; }
    const csv = toCSV(
      filtered.map(c => ({
        name: c.name,
        phone: c.phone,
        address: c.address || '',
        branch: c.branches?.name || '',
        total_orders: c.total_orders || 0,
        total_spent: c.total_spent || 0,
        last_order_date: c.last_order_date ? new Date(c.last_order_date).toISOString() : '',
      })),
      [
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'address', label: 'Address' },
        { key: 'branch', label: 'Branch' },
        { key: 'total_orders', label: 'Total Orders' },
        { key: 'total_spent', label: 'Total Spent (NGN)' },
        { key: 'last_order_date', label: 'Last Order Date' },
      ]
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} customers`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">Customers</h1>
          <p className="text-muted-foreground">View, search and export customer data</p>
        </div>
        <Button onClick={exportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="orders">Most orders</SelectItem>
                <SelectItem value="spend">Highest spend</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{filtered.length} customer{filtered.length !== 1 ? 's' : ''}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="hidden md:table-cell">Address</TableHead>
                    <TableHead className="hidden md:table-cell">Branch</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead className="hidden md:table-cell">Last Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
                  ) : filtered.map(c => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedCustomerId(c.id)}>
                      <TableCell className="font-medium flex items-center gap-2"><UserCircle className="h-4 w-4 text-muted-foreground" />{c.name}</TableCell>
                      <TableCell>{c.phone}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{c.address || '—'}</TableCell>
                      <TableCell className="hidden md:table-cell"><Badge variant="outline">{c.branches?.name || '—'}</Badge></TableCell>
                      <TableCell className="text-right">{c.total_orders || 0}</TableCell>
                      <TableCell className="text-right font-mono">₦{Number(c.total_spent || 0).toLocaleString()}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerDetailDialog
        customerId={selectedCustomerId}
        customer={filtered.find(c => c.id === selectedCustomerId) || null}
        onClose={() => setSelectedCustomerId(null)}
      />
    </div>
  );
}

function CustomerDetailDialog({ customerId, customer, onClose }: { customerId: string | null; customer: any | null; onClose: () => void }) {
  const { data: orders } = useCustomerOrders(customerId);
  return (
    <Dialog open={!!customerId} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{customer?.name || 'Customer'}</DialogTitle></DialogHeader>
        {customer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Phone:</span> {customer.phone}</div>
              <div><span className="text-muted-foreground">Branch:</span> {customer.branches?.name || '—'}</div>
              <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {customer.address || '—'}</div>
              <div><span className="text-muted-foreground">Total orders:</span> {customer.total_orders || 0}</div>
              <div><span className="text-muted-foreground">Total spent:</span> ₦{Number(customer.total_spent || 0).toLocaleString()}</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Order history</h3>
              <div className="border rounded-md max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(orders || []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">No orders</TableCell></TableRow>
                    ) : orders!.map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                        <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{o.order_type}</Badge></TableCell>
                        <TableCell><Badge variant={o.payment_status === 'paid' ? 'default' : 'secondary'} className="text-xs">{o.status}</Badge></TableCell>
                        <TableCell className="text-right font-mono">₦{Number(o.total || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
