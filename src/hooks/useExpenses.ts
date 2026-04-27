import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const EXPENSE_CATEGORIES = [
  'fuel', 'electricity', 'rent', 'salary', 'transport',
  'maintenance', 'supplies', 'marketing', 'others',
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export interface Expense {
  id: string;
  branch_id: string;
  amount: number;
  category: ExpenseCategory;
  description: string | null;
  expense_date: string;
  created_by: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useExpenses(branchId: string | null, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['expenses', branchId, dateFrom, dateTo],
    enabled: !!branchId,
    queryFn: async () => {
      let q = supabase.from('expenses' as any)
        .select('*')
        .is('deleted_at', null)
        .order('expense_date', { ascending: false });
      if (branchId) q = q.eq('branch_id', branchId);
      if (dateFrom) q = q.gte('expense_date', dateFrom);
      if (dateTo) q = q.lte('expense_date', dateTo);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as Expense[]) || [];
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  const { user, branchId } = useAuth();
  return useMutation({
    mutationFn: async (input: { amount: number; category: string; description?: string; expense_date?: string; branch_id?: string }) => {
      const { data, error } = await supabase.from('expenses' as any).insert({
        amount: input.amount,
        category: input.category,
        description: input.description || null,
        expense_date: input.expense_date || new Date().toISOString().slice(0, 10),
        branch_id: input.branch_id || branchId!,
        created_by: user!.id,
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense recorded');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; amount?: number; category?: string; description?: string; expense_date?: string }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from('expenses' as any).update(rest as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense updated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses' as any)
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
    },
    onError: (e: any) => toast.error(e.message),
  });
}
