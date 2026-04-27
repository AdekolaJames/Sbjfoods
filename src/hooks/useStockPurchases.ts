import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StockPurchase {
  id: string;
  stock_item_id: string;
  branch_id: string;
  quantity_added: number;
  unit_cost: number;
  total_cost: number;
  supplier: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export function useStockPurchases(stockItemId?: string | null) {
  return useQuery({
    queryKey: ['stock-purchases', stockItemId],
    queryFn: async () => {
      let q = supabase.from('stock_purchases').select('*').order('created_at', { ascending: false });
      if (stockItemId) q = q.eq('stock_item_id', stockItemId);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data || []) as StockPurchase[];
    },
  });
}

export function useCreateStockPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      stock_item_id: string;
      branch_id: string;
      quantity_added: number;
      unit_cost: number;
      supplier?: string | null;
      notes?: string | null;
      created_by: string;
    }) => {
      const { data, error } = await supabase.from('stock_purchases').insert({
        stock_item_id: payload.stock_item_id,
        branch_id: payload.branch_id,
        quantity_added: payload.quantity_added,
        unit_cost: payload.unit_cost,
        supplier: payload.supplier || null,
        notes: payload.notes || null,
        created_by: payload.created_by,
        total_cost: payload.quantity_added * payload.unit_cost,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-purchases'] });
      qc.invalidateQueries({ queryKey: ['stock-items'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}
