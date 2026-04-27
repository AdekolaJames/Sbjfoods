import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Order = Tables<'orders'>;

export type OrderStatus = 'pending_approval' | 'pending' | 'completed' | 'cancelled';

export function useOrders(branchId?: string | null, statusFilter?: OrderStatus[]) {
  return useQuery({
    queryKey: ['orders', branchId, statusFilter],
    enabled: true,
    queryFn: async () => {
      let q = supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (branchId) q = q.eq('branch_id', branchId);
      if (statusFilter?.length) q = q.in('status', statusFilter);
      const { data, error } = await q;
      console.log("ORDERS DATA:", data);
console.log("ORDERS ERROR:", error);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      order: {
        branch_id: string;
        cashier_id: string;
        order_number: string;
        order_type: 'takeaway' | 'delivery';
        table_id?: string | null;
        customer_name?: string | null;
        customer_phone?: string | null;
        customer_address?: string | null;
        notes?: string | null;
        subtotal: number;
        discount_amount?: number;
        discount_type?: string | null;
        tax_amount?: number;
        total: number;
        status: string;
        payment_status: string;
        offline_id?: string | null;
      };
      items: {
        menu_item_id: string;
        item_name: string;
        quantity: number;
        unit_price: number;
        total_price: number;
        notes?: string | null;
        addons?: { addon_id: string; addon_name: string; quantity: number; unit_price: number }[];
      }[];
    }) => {
      // Duplicate prevention: if this offline_id was already synced, return existing order.
      if (payload.order.offline_id) {
        const { data: existing } = await supabase
          .from('orders')
          .select('*')
          .eq('offline_id', payload.order.offline_id)
          .maybeSingle();
        if (existing) return existing;
      }

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert(payload.order as any)
        .select()
        .single();
      if (orderErr) throw orderErr;

      for (const item of payload.items) {
        const { addons, ...itemData } = item;
        const { data: oi, error: itemErr } = await supabase
          .from('order_items')
          .insert({ ...itemData, order_id: order.id })
          .select()
          .single();
        if (itemErr) throw itemErr;

        if (addons?.length) {
          const { error: addonErr } = await supabase
            .from('order_item_addons')
            .insert(addons.map(a => ({ ...a, order_item_id: oi.id })));
          if (addonErr) throw addonErr;
        }
      }

      return order;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard-orders-today'] });
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payments: {
      order_id: string;
      method: string;
      amount: number;
      reference?: string | null;
      branch_id: string;
      staff_id: string;
    }[]) => {
      const { error: payErr } = await supabase.from('payments').insert(payments);
      if (payErr) throw payErr;

      const { error: orderErr } = await supabase
        .from('orders')
        .update({ payment_status: 'paid' as any, status: 'completed' as any })
        .eq('id', payments[0].order_id);
      if (orderErr) throw orderErr;
    },
    onSuccess: async (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['orders'] });

      // Unified, idempotent inventory deduction (admin / staff / offline-sync all hit this path).
      // The RPC checks stock_movements for an existing sale_deduction on this order and skips if found,
      // so re-runs (e.g. retries, offline sync) never double-deduct.
      const orderId = variables[0].order_id;
      try {
        const { data, error } = await supabase.rpc('process_inventory_deduction', { _order_id: orderId });
        if (error) {
          console.error('[inventory] deduction RPC error', error);
          // Non-blocking: surface a soft warning so admins can retry from inventory.
          throw error;
        }
        if ((data as any)?.status === 'ok' && (data as any)?.deductions > 0) {
          qc.invalidateQueries({ queryKey: ['stock-items'] });
          qc.invalidateQueries({ queryKey: ['stock-movements'] });
        }
      } catch (e) {
        console.error('[inventory] Stock deduction failed for order', orderId, e);
      }
    },
  });
}

/**
 * Manual / retry hook to process inventory deduction for a given order.
 * Safe to call multiple times — backend skips if already deducted.
 */
export function useProcessInventoryDeduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc('process_inventory_deduction', { _order_id: orderId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-items'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}
