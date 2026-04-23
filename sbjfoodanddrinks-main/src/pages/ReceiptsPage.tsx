import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import { useBranches } from '@/hooks/useBranches';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReceiptDialog } from '@/components/ReceiptDialog';
import { Search, Receipt, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function ReceiptsPage() {
  const { branchId, role, profile } = useAuth();
  const { data: branches } = useBranches();
  const branch = branches?.find(b => b.id === branchId);
  const { data: orders, isLoading } = useOrders(role === 'admin' ? null : branchId, ['completed']);

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const filtered = (orders || []).filter(o =>
    !search || o.order_number.toLowerCase().includes(search.toLowerCase())
  );

  const openReceipt = async (order: any) => {
    // Fetch payment method
    const { data: pays } = await supabase.from('payments').select('method').eq('order_id', order.id);
    const method = pays?.length ? (pays.length > 1 ? 'split' : pays[0].method) : 'cash';
    setReceiptData({
      orderNumber: order.order_number,
      orderType: order.order_type,
      date: new Date(order.created_at).toLocaleString(),
      cashierName: profile?.full_name || 'Staff',
      branchName: branch?.name || '',
      items: (order.order_items || []).map((oi: any) => ({
        name: oi.item_name, quantity: oi.quantity, unitPrice: Number(oi.unit_price),
        totalPrice: Number(oi.total_price),
        addons: (oi.order_item_addons || []).map((a: any) => ({ name: a.addon_name, price: Number(a.unit_price), quantity: a.quantity })),
      })),
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discount_amount),
      discountType: order.discount_type,
      vatAmount: Number(order.tax_amount),
      serviceCharge: 0,
      total: Number(order.total),
      paymentMethod: method,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
    });
    setOpen(true);
  };

  const sendWhatsApp = (order: any) => {
    if (!order.customer_phone) { toast.error('No phone number on file'); return; }
    const phone = order.customer_phone.replace(/\D/g, '');
    const msg = `Receipt ${order.order_number}\nTotal: ₦${Number(order.total).toLocaleString()}\nThank you for choosing SBJ Foods & Drinks!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Receipts</h1>
        <p className="text-muted-foreground mt-1">Reprint, download or share past receipts</p>
      </div>

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
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No receipts found</TableCell></TableRow>
              ) : filtered.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                  <TableCell className="text-sm">{o.customer_name || '—'}</TableCell>
                  <TableCell className="text-sm capitalize">{o.order_type.replace('_', ' ')}</TableCell>
                  <TableCell className="font-semibold">₦{Number(o.total).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="outline" size="sm" onClick={() => openReceipt(o)}>
                      <Receipt className="h-3 w-3 mr-1" /> View
                    </Button>
                    {o.customer_phone && (
                      <Button variant="ghost" size="sm" onClick={() => sendWhatsApp(o)}>
                        <Send className="h-3 w-3 mr-1" /> WhatsApp
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ReceiptDialog open={open} onOpenChange={setOpen} receipt={receiptData} />
    </div>
  );
}
