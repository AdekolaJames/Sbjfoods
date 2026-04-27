import { useState } from 'react';
import { useBranches, useCreateBranch, useUpdateBranch } from '@/hooks/useBranches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Building2, Plus, Pencil, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function BranchesPage() {
  const { data: branches, isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '' });

  const resetForm = () => { setForm({ name: '', code: '', address: '', phone: '' }); setEditing(null); };

  const handleSubmit = async () => {
    if (!form.name || !form.code) { toast.error('Name and code are required'); return; }
    try {
      if (editing) {
        await updateBranch.mutateAsync({ id: editing, ...form });
        toast.success('Branch updated');
      } else {
        await createBranch.mutateAsync(form);
        toast.success('Branch created');
      }
      resetForm();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const editBranch = (b: any) => {
    setForm({ name: b.name, code: b.code, address: b.address || '', phone: b.phone || '' });
    setEditing(b.id);
    setOpen(true);
  };

  const toggleActive = async (b: any) => {
    try {
      await updateBranch.mutateAsync({ id: b.id, is_active: !b.is_active });
      toast.success(`Branch ${b.is_active ? 'deactivated' : 'activated'}`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Branches</h1>
          <p className="text-muted-foreground mt-1">Manage your restaurant outlets</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Branch</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Branch</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Branch Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="SBJ Foods INDY" /></div>
              <div><Label>Branch Code</Label><Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="INDY" disabled={!!editing} /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Branch address" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+234..." /></div>
              <Button className="w-full" onClick={handleSubmit} disabled={createBranch.isPending || updateBranch.isPending}>
                {editing ? 'Update' : 'Create'} Branch
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading branches...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {branches?.map(b => (
            <Card key={b.id} className="bg-card border-border">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-display">{b.name}</CardTitle>
                    <Badge variant={b.is_active ? 'default' : 'secondary'} className="mt-1 text-xs">{b.code}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                  <Button variant="ghost" size="icon" onClick={() => editBranch(b)}><Pencil className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {b.address && <p className="flex items-center gap-2"><MapPin className="h-3 w-3" />{b.address}</p>}
                {b.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" />{b.phone}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
