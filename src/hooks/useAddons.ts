import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Addon = Tables<'menu_item_addons'>;

export function useAddons(branchId?: string | null) {
  return useQuery({
    queryKey: ['addons', branchId],
    enabled: !!branchId, // 🔥 prevents null branch calls
    queryFn: async () => {
      let q = supabase
        .from('menu_item_addons')
        .select('*')
        .order('name');

      if (branchId) {
        q = q.eq('branch_id', branchId);
      }

      const { data, error } = await q;

      if (error) throw error;

      return data as Addon[];
    },
  });
}

export function useCreateAddon() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (addon: TablesInsert<'menu_item_addons'>) => {
      const { data, error } = await supabase
        .from('menu_item_addons')
        .insert(addon)
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addons'] }),
  });
}

export function useUpdateAddon() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      { id, ...updates }: TablesUpdate<'menu_item_addons'> & { id: string }
    ) => {
      const { data, error } = await supabase
        .from('menu_item_addons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addons'] }),
  });
}

export function useDeleteAddon() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_item_addons')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addons'] }),
  });
}