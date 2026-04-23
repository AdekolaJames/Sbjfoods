import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateStockPurchase } from '@/hooks/useStockPurchases';
import { toast } from 'sonner';
import { TrendingUp } from 'lucide-react';

interface Props {
  stockItemId: string | null;
  itemName?: string;
  currentAvgCost?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Records a new stock purchase batch. The DB trigger `handle_stock_purchase()`
 * automatically:
 *  - increases stock_items.quantity
 *  - recomputes average_cost using Weighted Average Cost (WAC)
 *  - inserts a corresponding stock_movements row
 */
export function StockPurchaseDialog({ stockItemId, itemName, currentAvgCost, open, onOpenChange }: Props) {
  const { user, branchId } = useAuth();
  const createPurchase = useCreateStockPurchase();
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setQty(''); setUnitCost(''); setSupplier(''); setNotes('');
  };

  const submit = async () => {
    if (!stockItemId || !user || !branchId) return;
    const q = Number(qty), c = Number(unitCost);
    if (!q || q <= 0) { toast.error('Enter a valid quantity'); return; }
    if (c < 0 || isNaN(c)) { toast.error('Unit cost is required'); return; }
    try {
      await createPurchase.mutateAsync({
        stock_item_id: stockItemId,
        branch_id: branchId,
        quantity_added: q,
        unit_cost: c,
        supplier: supplier || null,
        notes: notes || null,
        created_by: user.id,
      });
      toast.success(`Purchase recorded — quantity & average cost updated`);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to record purchase');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Add Stock (New Purchase) — {itemName}
          </DialogTitle>
          <DialogDescription>
            New purchases automatically update stock quantity and recalculate the weighted average cost.
            {currentAvgCost !== undefined && currentAvgCost > 0 && (
              <span className="block mt-1 text-xs">Current avg cost: <strong>₦{currentAvgCost.toLocaleString()}</strong></span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Quantity *</Label>
              <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 50" />
            </div>
            <div>
              <Label>Unit Cost (₦) *</Label>
              <Input type="number" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="e.g. 1200" />
            </div>
          </div>
          {qty && unitCost && (
            <p className="text-xs text-muted-foreground">
              Total cost: <strong>₦{(Number(qty) * Number(unitCost)).toLocaleString()}</strong>
            </p>
          )}
          <div>
            <Label>Supplier (optional)</Label>
            <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier name" />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Invoice #, batch, etc." />
          </div>
          <Button className="w-full" onClick={submit} disabled={createPurchase.isPending || !qty || !unitCost}>
            {createPurchase.isPending ? 'Recording...' : 'Record Purchase'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
