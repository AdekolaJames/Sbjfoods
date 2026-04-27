import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ALL_ROLES, AppRole, PERMISSION_GROUPS, useRolePermissions, useUpdateRolePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';

type LocalState = Record<AppRole, Record<string, boolean>>;

export function PermissionsSection() {
  const { data: perms, isLoading } = useRolePermissions();
  const update = useUpdateRolePermissions();
  const [local, setLocal] = useState<LocalState | null>(null);
  const [activeRole, setActiveRole] = useState<AppRole>('cashier');

  useEffect(() => {
    if (!perms) return;
    const map: LocalState = { admin: {}, branch_manager: {}, cashier: {}, waiter: {} } as LocalState;
    for (const p of perms) {
      // Skip legacy 'kitchen' rows — role removed from UI
      if (!ALL_ROLES.includes(p.role_name as AppRole)) continue;
      map[p.role_name as AppRole][p.permission_key] = p.is_enabled;
    }
    setLocal(map);
  }, [perms]);

  const toggle = (role: AppRole, key: string, value: boolean) => {
    setLocal(prev => prev ? { ...prev, [role]: { ...prev[role], [key]: value } } : prev);
  };

  const dirty = useMemo(() => {
    if (!perms || !local) return false;
    for (const p of perms) {
      if (!ALL_ROLES.includes(p.role_name as AppRole)) continue;
      if ((local[p.role_name as AppRole][p.permission_key] ?? false) !== p.is_enabled) return true;
    }
    return false;
  }, [perms, local]);

  const save = async () => {
    if (!local) return;
    // Safety: prevent removing all permissions for non-admin role
    for (const role of ALL_ROLES) {
      if (role === 'admin') continue;
      const enabled = Object.values(local[role]).some(Boolean);
      if (!enabled) {
        toast.error(`Cannot leave "${role.replace('_', ' ')}" with zero permissions. Enable at least one.`);
        return;
      }
    }
    const rows: { role_name: AppRole; permission_key: string; is_enabled: boolean }[] = [];
    for (const role of ALL_ROLES) {
      for (const group of PERMISSION_GROUPS) {
        for (const p of group.permissions) {
          rows.push({ role_name: role, permission_key: p.key, is_enabled: !!local[role][p.key] });
        }
      }
    }
    try {
      await update.mutateAsync(rows);
      toast.success('Permissions updated');
    } catch (e: any) { toast.error(e.message); }
  };

  if (isLoading || !local) return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Staff Permissions</CardTitle>
        <CardDescription>
          Fine-grained feature control per role. Admin always has full access (toggles ignored).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeRole} onValueChange={v => setActiveRole(v as AppRole)}>
          <TabsList className="flex flex-wrap h-auto">
            {ALL_ROLES.map(r => (
              <TabsTrigger key={r} value={r} className="capitalize">
                {r.replace('_', ' ')}
              </TabsTrigger>
            ))}
          </TabsList>
          {ALL_ROLES.map(role => (
            <TabsContent key={role} value={role} className="space-y-4 mt-4">
              {role === 'admin' && (
                <div className="text-sm p-3 rounded bg-primary/10 border border-primary/30">
                  Admin always has unrestricted access. Toggles below are reference-only.
                </div>
              )}
              {PERMISSION_GROUPS.map(group => (
                <div key={group.group}>
                  <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{group.group}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.permissions.map(p => (
                      <label key={p.key} className="flex items-center justify-between p-2 rounded border hover:bg-secondary/40">
                        <span className="text-sm">{p.label}</span>
                        <Switch
                          checked={!!local[role][p.key]}
                          disabled={role === 'admin'}
                          onCheckedChange={v => toggle(role, p.key, v)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>
          ))}
        </Tabs>
        <div className="flex justify-end gap-2">
          <Button onClick={save} disabled={!dirty || update.isPending}>
            {update.isPending ? 'Saving...' : 'Save Permissions'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
