import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useUnits(includeInactive = false) {
  return useQuery({
    queryKey: ['units', includeInactive],
    queryFn: async () => {
      let q = supabase.from('units' as any).select('*').order('name');
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as Unit[]) || [];
    },
  });
}

export function useCreateUnit() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; symbol: string }) => {
      const { error } = await supabase.from('units' as any).insert({
        name: input.name, symbol: input.symbol, created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] });
      toast.success('Unit added');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; symbol?: string; is_active?: boolean }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from('units' as any).update(rest as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] });
      toast.success('Unit updated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: mark inactive
      const { error } = await supabase.from('units' as any).update({ is_active: false } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] });
      toast.success('Unit deactivated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}
