import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StaffMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  branch_id: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  deleted_at: string | null;
  role?: string;
  branch_name?: string;
  /** All branches assigned to this user (multi-branch) */
  branches?: { id: string; name: string }[];
}

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const [profilesRes, rolesRes, assignmentsRes] = await Promise.all([
        supabase.from('profiles').select('*, branches(name)').is('deleted_at', null).order('full_name'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('staff_branch_assignments').select('user_id, branch_id, branches:branch_id(id, name)'),
      ]);
      if (profilesRes.error) throw profilesRes.error;

      const roleMap = new Map(rolesRes.data?.map(r => [r.user_id, r.role]) || []);

      const branchMap = new Map<string, { id: string; name: string }[]>();
      for (const a of (assignmentsRes.data || []) as any[]) {
        const arr = branchMap.get(a.user_id) || [];
        if (a.branches) arr.push({ id: a.branches.id, name: a.branches.name });
        branchMap.set(a.user_id, arr);
      }

      return (profilesRes.data || []).map((p: any) => {
        const branches = branchMap.get(p.user_id) || [];
        return {
          id: p.id,
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          branch_id: p.branch_id,
          is_active: p.is_active,
          last_login: p.last_login,
          created_at: p.created_at,
          deleted_at: p.deleted_at,
          role: roleMap.get(p.user_id) || 'unknown',
          branch_name: branches.map(b => b.name).join(', ') || p.branches?.name || 'Unassigned',
          branches,
        };
      }) as StaffMember[];
    },
  });
}

export function useUpdateStaffStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, isActive }: { profileId: string; isActive: boolean }) => {
      const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', profileId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('create-staff', {
        body: { action: 'delete', user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { user_id: string; full_name?: string; email?: string; role?: string; branch_ids?: string[] }) => {
      const { data, error } = await supabase.functions.invoke('create-staff', {
        body: { action: 'update', ...payload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useResetStaffPassword() {
  return useMutation({
    mutationFn: async (payload: { user_id: string; new_password: string }) => {
      const { data, error } = await supabase.functions.invoke('create-staff', {
        body: { action: 'reset_password', ...payload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
  });
}
