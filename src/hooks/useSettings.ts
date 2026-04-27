import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BusinessSettings {
  id: string;
  branch_id: string | null;
  business_name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  vat_percent: number;
  service_charge_percent: number;
  receipt_footer: string | null;
  enable_cash: boolean;
  enable_transfer: boolean;
  enable_pos: boolean;
  currency: string;
}

export function useSettings() {
  return useQuery({
    queryKey: ['business-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .is('branch_id', null)
        .maybeSingle();
      if (error) throw error;
      return data as BusinessSettings | null;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<BusinessSettings> & { id: string }) => {
      const { id, ...rest } = updates;
      const { error } = await supabase.from('business_settings').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-settings'] }),
  });
}
