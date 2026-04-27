import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BranchAssignment {
  id: string;
  user_id: string;
  branch_id: string;
  branches?: { id: string; name: string; code: string } | null;
}

export function useUserBranches(userId?: string) {
  return useQuery({
    queryKey: ['user-branches', userId],
    queryFn: async () => {
      if (!userId) return [];
      // Fetch assignments first, then join branch info from the public branches table
      const { data, error } = await supabase
        .from('staff_branch_assignments')
        .select('id, user_id, branch_id, branches:branch_id (id, name, code)')
        .eq('user_id', userId);
      if (error) throw error;
      return (data || []) as BranchAssignment[];
    },
    enabled: !!userId,
  });
}
