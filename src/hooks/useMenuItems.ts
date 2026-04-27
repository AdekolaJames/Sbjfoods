import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type MenuItem = Tables<'menu_items'> & { menu_categories?: { name: string } | null };

export function useMenuItems(branchId?: string | null, categoryId?: string | null) {
  return useQuery({
    queryKey: ['menu_items', branchId, categoryId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = supabase.from('menu_items').select('*, menu_categories(name)').order('display_order');
      if (branchId) q = q.eq('branch_id', branchId);
      if (categoryId) q = q.eq('category_id', categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return data as MenuItem[];
    },
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: TablesInsert<'menu_items'>) => {
      const { data, error } = await supabase.from('menu_items').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_items'] }),
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'menu_items'> & { id: string }) => {
      const { data, error } = await supabase.from('menu_items').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_items'] }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_items'] }),
  });
}
