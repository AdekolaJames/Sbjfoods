import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Edit } from 'lucide-react';

interface StockItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  base_unit?: string | null;
  sub_unit?: string | null;
  conversion_rate?: number;
  supplier?: string | null;
  low_stock_threshold: number;
}

interface Props {
  item: StockItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Edit metadata of a stock item.
 * Important: quantity and average_cost are NOT editable here — they can only
 * change via "Add Stock (Purchase)" or "Adjust Stock" so all changes are auditable.
 */
export function EditStockItemDialog({ item, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '', category: 'general', unit: 'pc',
    base_unit: '', sub_unit: '', conversion_rate: '1',
    supplier: '', low_stock_threshold: '5',
  });

  // Sync form when item changes
  useState(() => {
    if (item) {
      setForm({
        name: item.name,
        category: item.category,
        unit: item.unit,
        base_unit: item.base_unit || '',
        sub_unit: item.sub_unit || '',
        conversion_rate: String(item.conversion_rate || 1),
        supplier: item.supplier || '',
        low_stock_threshold: String(item.low_stock_threshold),
      });
    }
  });

  // Re-sync when item prop changes
  if (item && form.name !== item.name && open) {
    // Defer to avoid setState during render
    setTimeout(() => {
      setForm({
        name: item.name,
        category: item.category,
        unit: item.unit,
        base_unit: item.base_unit || '',
        sub_unit: item.sub_unit || '',
        conversion_rate: String(item.conversion_rate || 1),
        supplier: item.supplier || '',
        low_stock_threshold: String(item.low_stock_threshold),
      });
    }, 0);
  }

  const save = async () => {
    if (!item || !user) return;
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      const { error } = await supabase.from('stock_items').update({
        name: form.name,
        category: form.category,
        unit: form.unit,
        base_unit: form.base_unit || null,
        sub_unit: form.sub_unit || null,
        conversion_rate: Number(form.conversion_rate) || 1,
        supplier: form.supplier || null,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
      }).eq('id', item.id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: user.id, user_name: user.email,
        action: 'stock_item.update', entity_type: 'stock_item', entity_id: item.id,
        details: { name: form.name, category: form.category, unit: form.unit },
      });

      qc.invalidateQueries({ queryKey: ['stock-items'] });
      toast.success('Stock item updated');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" /> Edit Stock Item
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['general', 'proteins', 'grains', 'oils', 'vegetables', 'spices', 'packaging', 'drinks'].map(c => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Base Unit</Label>
              <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v, base_unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pc', 'kg', 'g', 'L', 'ml', 'bag', 'crate'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Sub-unit (optional)</Label>
              <Input value={form.sub_unit} onChange={e => setForm(f => ({ ...f, sub_unit: e.target.value }))} placeholder="e.g. g" />
            </div>
            <div>
              <Label>Conversion Rate</Label>
              <Input type="number" value={form.conversion_rate} onChange={e => setForm(f => ({ ...f, conversion_rate: e.target.value }))} />
            </div>
          </div>
          {form.sub_unit && (
            <p className="text-xs text-muted-foreground">1 {form.unit} = {form.conversion_rate || 1} {form.sub_unit}</p>
          )}
          <div>
            <Label>Supplier</Label>
            <Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
          </div>
          <div>
            <Label>Low stock alert threshold</Label>
            <Input type="number" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))} />
          </div>
          <p className="text-xs text-muted-foreground border-t pt-2">
            Note: Quantity and average cost cannot be edited directly — use <strong>Add Purchase</strong> or <strong>Adjust Stock</strong>.
          </p>
          <Button className="w-full" onClick={save}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
