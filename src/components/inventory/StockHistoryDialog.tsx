import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Package } from 'lucide-react';

interface Props {
  stockItemId: string | null;
  itemName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockHistoryDialog({
  stockItemId,
  itemName,
  open,
  onOpenChange,
}: Props) {

  const { data: purchases, isLoading: loadingPurchases } = useQuery({
    queryKey: ['stock-history-purchases', stockItemId],
    enabled: open && !!stockItemId,
    queryFn: async () => {
      if (!stockItemId) return [];

      const { data, error } = await supabase
        .from('stock_purchases')
        .select('*')
        .eq('stock_item_id', stockItemId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return data || [];
    },
  });

  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: ['stock-history-movements', stockItemId],
    enabled: open && !!stockItemId,
    queryFn: async () => {
      if (!stockItemId) return [];

      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('stock_item_id', stockItemId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      return data || [];
    },
  });

  const actionBadge = (a: string) => {
    if (a === 'purchase' || a === 'add') return 'default';
    if (a === 'waste') return 'destructive';
    if (a === 'sale' || a === 'remove') return 'secondary';
    return 'outline';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock History — {itemName || ''}
          </DialogTitle>
          <DialogDescription>
            Full audit trail of purchases and stock movements.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="purchases">
          <TabsList>
            <TabsTrigger value="purchases">
              Purchases ({purchases?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="movements">
              Movements ({movements?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchases">
            <ScrollArea className="h-[400px]">
              {loadingPurchases ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Supplier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases?.length ? (
                      purchases.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">
                            {new Date(p.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>{p.quantity_added}</TableCell>
                          <TableCell>
                            ₦{Number(p.unit_cost).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            ₦{Number(p.total_cost).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs">
                            {p.supplier || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No purchases recorded
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="movements">
            <ScrollArea className="h-[400px]">
              {loadingMovements ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements?.length ? (
                      movements.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">
                            {new Date(m.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={actionBadge(m.action) as any}
                              className="capitalize"
                            >
                              {m.action}
                            </Badge>
                          </TableCell>
                          <TableCell>{m.quantity}</TableCell>
                          <TableCell className="text-xs">
                            {m.reason || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No movements
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}