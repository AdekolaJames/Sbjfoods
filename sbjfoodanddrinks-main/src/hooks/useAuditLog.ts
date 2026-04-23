import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AuditEntry {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  branch_id?: string | null;
  details?: Record<string, any> | null;
}

export function useAuditLog() {
  return useMutation({
    mutationFn: async (entry: AuditEntry) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        user_name: user.email || null,
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id || null,
        branch_id: entry.branch_id || null,
        details: entry.details || null,
      });
    },
  });
}
