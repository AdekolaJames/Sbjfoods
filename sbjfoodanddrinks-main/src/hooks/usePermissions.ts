import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export type AppRole = 'admin' | 'cashier' | 'kitchen' | 'waiter' | 'branch_manager';

export interface RolePermission {
  id: string;
  role_name: AppRole;
  permission_key: string;
  is_enabled: boolean;
}

/** Catalog of permissions, grouped for the settings UI */
export const PERMISSION_GROUPS: { group: string; permissions: { key: string; label: string }[] }[] = [
  {
    group: 'Sales / POS',
    permissions: [
      { key: 'create_order', label: 'Create order' },
      { key: 'edit_order', label: 'Edit order' },
      { key: 'cancel_order', label: 'Cancel order' },
      { key: 'apply_discount', label: 'Apply discount' },
      { key: 'split_payment', label: 'Split payment' },
    ],
  },
  {
    group: 'Orders',
    permissions: [
      { key: 'view_orders', label: 'View orders' },
      { key: 'update_order_status', label: 'Update order status' },
    ],
  },
  {
    group: 'Inventory',
    permissions: [
      { key: 'view_inventory', label: 'View inventory' },
      { key: 'add_stock', label: 'Add stock' },
      { key: 'edit_stock', label: 'Edit stock' },
      { key: 'delete_stock', label: 'Delete stock' },
    ],
  },
  {
    group: 'Menu',
    permissions: [
      { key: 'create_menu', label: 'Create menu items' },
      { key: 'edit_menu', label: 'Edit menu items' },
      { key: 'delete_menu', label: 'Delete menu items' },
    ],
  },
  {
    group: 'Staff',
    permissions: [
      { key: 'create_staff', label: 'Create staff' },
      { key: 'edit_staff', label: 'Edit staff' },
      { key: 'delete_staff', label: 'Delete staff' },
    ],
  },
  {
    group: 'Reports',
    permissions: [
      { key: 'view_reports', label: 'View reports' },
      { key: 'view_profit_loss', label: 'View profit & loss' },
    ],
  },
  {
    group: 'Settings',
    permissions: [
      { key: 'access_settings', label: 'Access settings' },
    ],
  },
];

// 'kitchen' is intentionally excluded — module removed. Type kept for DB enum compatibility only.
export const ALL_ROLES: AppRole[] = ['admin', 'branch_manager', 'cashier', 'waiter'];

export function useRolePermissions() {
  return useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('role_permissions').select('*');
      if (error) throw error;
      return (data || []) as RolePermission[];
    },
    staleTime: 60_000,
  });
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { role_name: AppRole; permission_key: string; is_enabled: boolean }[]) => {
      const { error } = await supabase.from('role_permissions').upsert(rows, { onConflict: 'role_name,permission_key' });
      if (error) throw error;
      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id, user_name: user.email,
          action: 'permissions.update', entity_type: 'role_permissions',
          details: { changes: rows },
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['role-permissions'] }),
  });
}

/**
 * Hook for the CURRENT user — returns a `can(permissionKey)` function.
 * Admins always return true.
 */
export function usePermissionCheck() {
  const { role } = useAuth();
  const { data: perms } = useRolePermissions();

  const allowed = useMemo(() => {
    if (role === 'admin') return null; // null = full access (handled in `can`)
    if (!perms || !role) return new Set<string>();
    return new Set(perms.filter(p => p.role_name === role && p.is_enabled).map(p => p.permission_key));
  }, [perms, role]);

  return useMemo(() => {
    return {
      can: (permissionKey: string) => {
        if (role === 'admin') return true;
        if (!allowed) return false;
        return allowed.has(permissionKey);
      },
      isAdmin: role === 'admin',
    };
  }, [allowed, role]);
}
