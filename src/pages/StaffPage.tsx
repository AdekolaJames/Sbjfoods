import { useState } from 'react';
import { useStaff, useUpdateStaffStatus, useDeleteStaff, useUpdateStaff, useResetStaffPassword, type StaffMember } from '@/hooks/useStaff';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Search, Trash2, Pencil, KeyRound, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

// Kitchen role removed from UI — system now operates as fast retail/eatery POS.
const ROLES = ['admin', 'cashier', 'waiter', 'branch_manager'] as const;

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function StaffPage() {
  const { user: currentUser } = useAuth();
  const { data: staff, isLoading } = useStaff();
  const { data: branches } = useBranches();
  const updateStatus = useUpdateStaffStatus();
  const deleteStaff = useDeleteStaff();
  const updateStaff = useUpdateStaff();
  const resetPassword = useResetStaffPassword();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'cashier', branch_ids: [] as string[] });

  // Edit dialog state
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', role: 'cashier', branch_ids: [] as string[] });

  // Reset password dialog state
  const [resetting, setResetting] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const filtered = staff?.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleBranch = (branchId: string) => {
    setForm(p => ({
      ...p,
      branch_ids: p.branch_ids.includes(branchId)
        ? p.branch_ids.filter(id => id !== branchId)
        : [...p.branch_ids, branchId],
    }));
  };

  const toggleEditBranch = (branchId: string) => {
    setEditForm(p => ({
      ...p,
      branch_ids: p.branch_ids.includes(branchId)
        ? p.branch_ids.filter(id => id !== branchId)
        : [...p.branch_ids, branchId],
    }));
  };

  const handleCreate = async () => {
    if (!form.full_name || !form.email || !form.password || !form.branch_ids.length) {
      toast.error('All fields are required. Select at least one branch.');
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('create-staff', {
        body: { ...form, branch_id: form.branch_ids[0], branch_ids: form.branch_ids },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Staff member created');
      setForm({ full_name: '', email: '', password: '', role: 'cashier', branch_ids: [] });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEdit = (s: StaffMember) => {
    setEditing(s);
    setEditForm({
      full_name: s.full_name,
      email: s.email,
      role: s.role || 'cashier',
      branch_ids: s.branches?.map(b => b.id) || [],
    });
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (!editForm.full_name || !editForm.email) { toast.error('Name and email required'); return; }
    if (editForm.branch_ids.length === 0) { toast.error('Assign at least one branch'); return; }
    try {
      await updateStaff.mutateAsync({
        user_id: editing.user_id,
        full_name: editForm.full_name,
        email: editForm.email,
        role: editForm.role,
        branch_ids: editForm.branch_ids,
      });
      toast.success('Staff updated');
      setEditing(null);
    } catch (e: any) { toast.error(e.message || 'Failed to update'); }
  };

  const openReset = (s: StaffMember) => {
    setResetting(s);
    setNewPassword('');
  };

  const handleResetPassword = async () => {
    if (!resetting) return;
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    try {
      await resetPassword.mutateAsync({ user_id: resetting.user_id, new_password: newPassword });
      toast.success(`Password reset for ${resetting.full_name}`);
      setResetting(null);
      setNewPassword('');
    } catch (e: any) { toast.error(e.message || 'Failed to reset'); }
  };

  const roleBadgeColor = (role: string) => {
    const map: Record<string, string> = {
      admin: 'bg-primary/20 text-primary',
      cashier: 'bg-green-500/20 text-green-400',
      waiter: 'bg-blue-500/20 text-blue-400',
      branch_manager: 'bg-purple-500/20 text-purple-400',
    };
    return map[role] || '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">Staff Management</h1>
          <p className="text-muted-foreground mt-1">Manage your team members</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" />Add Staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Staff Account</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div>
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input type="text" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                  <Button type="button" variant="outline" size="icon" onClick={() => setForm(p => ({ ...p, password: generatePassword() }))}><RefreshCw className="h-4 w-4" /></Button>
                </div>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Branch Assignment(s)</Label>
                <p className="text-xs text-muted-foreground mb-2">Select one or more branches</p>
                <div className="space-y-2">
                  {branches?.map(b => (
                    <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={form.branch_ids.includes(b.id)} onCheckedChange={() => toggleBranch(b.id)} />
                      <span className="text-sm">{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={handleCreate}>Create Staff</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branches</TableHead>
                <TableHead className="hidden md:table-cell">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No staff found</TableCell></TableRow>
              ) : (
                filtered?.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{s.email}</TableCell>
                    <TableCell><Badge className={roleBadgeColor(s.role || '')}>{(s.role || '').replace('_', ' ')}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {(s.branches && s.branches.length > 0) ? s.branches.map(b => (
                          <Badge key={b.id} variant="outline" className="text-xs">{b.name}</Badge>
                        )) : <span className="text-xs text-muted-foreground">Unassigned</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Switch checked={s.is_active} onCheckedChange={() => updateStatus.mutate({ profileId: s.id, isActive: !s.is_active })} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} title="Edit staff">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openReset(s)} title="Reset password">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete staff" disabled={s.user_id === currentUser?.id}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {s.full_name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Permanently revokes login access and removes branch & role assignments.
                                Past sales and audit logs are preserved.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={async () => {
                                  try {
                                    await deleteStaff.mutateAsync(s.user_id);
                                    toast.success('Staff deleted');
                                  } catch (e: any) { toast.error(e.message || 'Failed to delete'); }
                                }}
                              >
                                Delete Staff
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {editing?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name</Label><Input value={editForm.full_name} onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div>
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned Branches</Label>
              <div className="space-y-2 mt-1">
                {branches?.map(b => (
                  <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={editForm.branch_ids.includes(b.id)} onCheckedChange={() => toggleEditBranch(b.id)} />
                    <span className="text-sm">{b.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleUpdate} disabled={updateStaff.isPending}>
              {updateStaff.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetting} onOpenChange={open => !open && setResetting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password — {resetting?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New password</Label>
              <div className="flex gap-2">
                <Input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
                <Button type="button" variant="outline" size="icon" onClick={() => setNewPassword(generatePassword())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Share this password securely with the staff member.</p>
            </div>
            <Button className="w-full" onClick={handleResetPassword} disabled={resetPassword.isPending || newPassword.length < 6}>
              {resetPassword.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
