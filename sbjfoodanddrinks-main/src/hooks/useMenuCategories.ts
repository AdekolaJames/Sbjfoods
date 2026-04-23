import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type MenuCategory = Tables<'menu_categories'>;

export function useMenuCategories(branchId?: string | null) {
  return useQuery({
    queryKey: ['menu_categories', branchId],
    queryFn: async () => {
      let q = supabase.from('menu_categories').select('*').order('sort_order');
      if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return data as MenuCategory[];
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: TablesInsert<'menu_categories'>) => {
      const { data, error } = await supabase.from('menu_categories').insert(cat).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'menu_categories'> & { id: string }) => {
      const { data, error } = await supabase.from('menu_categories').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_categories'] }),
  });
}
