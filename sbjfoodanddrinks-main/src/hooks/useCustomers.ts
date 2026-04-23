import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address: string | null;
  branch_id: string | null;
  total_orders?: number;
  total_spent?: number;
  last_order_date?: string | null;
  created_at?: string;
  branches?: { id: string; name: string } | null;
}

export function useCustomers(branchId?: string | null) {
  return useQuery({
    queryKey: ['customers', branchId || 'all'],
    queryFn: async () => {
      let q = supabase
        .from('customers')
        .select('*, branches:branch_id(id, name)')
        .order('last_order_date', { ascending: false, nullsFirst: false });
      if (branchId) q = q.eq('branch_id', branchId);
      const { data, error } = await q.limit(2000);
      if (error) throw error;
      return (data || []) as Customer[];
    },
  });
}

export function useCustomerByPhone(phone: string, branchId?: string | null) {
  return useQuery({
    queryKey: ['customer-phone', phone, branchId],
    queryFn: async () => {
      if (!phone || phone.length < 5) return null;
      let q = supabase.from('customers').select('*').eq('phone', phone);
      if (branchId) q = q.eq('branch_id', branchId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
    enabled: !!phone && phone.length >= 5,
  });
}

export function useUpsertCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customer: { name: string; phone: string; address?: string | null; branch_id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .upsert(customer, { onConflict: 'phone,branch_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useCustomerOrders(customerId?: string | null) {
  return useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total, payment_status, status, order_type, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });
}
