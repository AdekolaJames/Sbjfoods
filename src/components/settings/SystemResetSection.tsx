import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Eye } from 'lucide-react';

interface ResetOptions {
  orders: boolean;
  payments: boolean;
  movements: boolean;
  resetStockQty: boolean;
  hardDelete: boolean;
  branchScope: string; // 'all' or branch_id
}

interface PreviewCounts {
  orders: number;
  order_items: number;
  payments: number;
  movements: number;
  stock_items_to_zero: number;
}

export function SystemResetSection() {
  const { role } = useAuth();
  const { data: branches } = useBranches();
  const [opts, setOpts] = useState<ResetOptions>({
    orders: true,
    payments: true,
    movements: false,
    resetStockQty: false,
    hardDelete: false,
    branchScope: 'all',
  });
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewCounts | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Frontend RBAC guard — backend RPC also enforces admin
  if (role !== 'admin') {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Access denied
          </CardTitle>
          <CardDescription>
            System Reset is restricted to admin accounts only.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const setOpt = <K extends keyof ResetOptions>(k: K, v: ResetOptions[K]) =>
    setOpts(p => ({ ...p, [k]: v }));

  const anyScopeSelected = opts.orders || opts.payments || opts.movements || opts.resetStockQty;

  const runPreview = async () => {
    if (!anyScopeSelected) {
      toast.error('Select at least one reset option to preview');
      return;
    }
    setPreviewing(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.rpc('system_reset_preview', {
        _scope_orders: opts.orders,
        _scope_payments: opts.payments,
        _scope_movements: opts.movements,
        _reset_stock_qty: opts.resetStockQty,
        _branch_id: opts.branchScope === 'all' ? null : opts.branchScope,
      });
      if (error) throw error;
      setPreview(data as unknown as PreviewCounts);
      setDialogOpen(true);
    } catch (e: any) {
      toast.error(e.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleReset = async () => {
    if (confirmText !== 'RESET') {
      toast.error('Type RESET to confirm');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('system_reset', {
        _scope_orders: opts.orders,
        _scope_payments: opts.payments,
        _scope_movements: opts.movements,
        _reset_stock_qty: opts.resetStockQty,
        _hard_delete: opts.hardDelete,
        _branch_id: opts.branchScope === 'all' ? null : opts.branchScope,
      });
      if (error) throw error;
      const r = data as any;
      toast.success('System reset complete', {
        description: `Orders: ${r?.orders ?? 0} · Payments: ${r?.payments ?? 0} · Movements: ${r?.movements ?? 0} · Stock zeroed: ${r?.stock_reset ?? 0}`,
      });
      setConfirmText('');
      setPreview(null);
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" /> System Reset / Fresh Start
        </CardTitle>
        <CardDescription>
          Clear transactional data while preserving staff, branches, menu, recipes, units and settings.
          Always preview first to see exactly what will be removed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-secondary/40">
            <Checkbox checked={opts.orders} onCheckedChange={v => setOpt('orders', !!v)} />
            <div>
              <p className="font-medium text-sm">Orders & order items</p>
              <p className="text-xs text-muted-foreground">All orders, held, cancelled, items & addons</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-secondary/40">
            <Checkbox checked={opts.payments} onCheckedChange={v => setOpt('payments', !!v)} />
            <div>
              <p className="font-medium text-sm">Payments & receipts</p>
              <p className="text-xs text-muted-foreground">All payment records and receipt history</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-secondary/40">
            <Checkbox checked={opts.movements} onCheckedChange={v => setOpt('movements', !!v)} />
            <div>
              <p className="font-medium text-sm">Stock movements & wastage</p>
              <p className="text-xs text-muted-foreground">All inventory movement history</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-secondary/40">
            <Checkbox checked={opts.resetStockQty} onCheckedChange={v => setOpt('resetStockQty', !!v)} />
            <div>
              <p className="font-medium text-sm">Reset stock quantities to zero</p>
              <p className="text-xs text-muted-foreground">Stock items remain — only quantities go to 0</p>
            </div>
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Branch scope</Label>
            <Select value={opts.branchScope} onValueChange={v => setOpt('branchScope', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label>Hard delete</Label>
              <p className="text-xs text-muted-foreground">Permanently remove rows (default: soft delete)</p>
            </div>
            <Switch checked={opts.hardDelete} onCheckedChange={v => setOpt('hardDelete', v)} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
          <p className="font-semibold">Preserved (never touched):</p>
          <p className="text-muted-foreground">
            Staff accounts · Branches · Menu items & categories · Recipes · Units · Business settings · Permissions · Auth users
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={runPreview} disabled={previewing || !anyScopeSelected}>
            {previewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
            Preview Impact
          </Button>
        </div>

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> This action cannot be undone
              </AlertDialogTitle>
              <AlertDialogDescription>
                You are about to <strong>{opts.hardDelete ? 'permanently delete' : 'soft-delete'}</strong> the data below
                {opts.branchScope === 'all'
                  ? ' across ALL branches'
                  : ` for branch "${branches?.find(b => b.id === opts.branchScope)?.name || ''}"`}.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {preview && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1">
                <p className="font-semibold text-destructive">Will be affected:</p>
                {opts.orders && (
                  <p>• Orders: <strong>{preview.orders}</strong> (with {preview.order_items} items)</p>
                )}
                {opts.payments && (
                  <p>• Payments: <strong>{preview.payments}</strong></p>
                )}
                {opts.movements && (
                  <p>• Stock movements: <strong>{preview.movements}</strong></p>
                )}
                {opts.resetStockQty && (
                  <p>• Stock items zeroed: <strong>{preview.stock_items_to_zero}</strong></p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-destructive">Type <strong>RESET</strong> to confirm</Label>
              <Input
                placeholder='Type RESET'
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                autoFocus
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmText !== 'RESET' || loading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleReset}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Reset'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
