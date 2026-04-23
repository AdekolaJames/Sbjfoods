import { useState } from 'react';
import { useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit } from '@/hooks/useUnits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Ruler } from 'lucide-react';

export default function UnitsPage() {
  const { data: units, isLoading } = useUnits(true);
  const createMut = useCreateUnit();
  const updateMut = useUpdateUnit();
  const deleteMut = useDeleteUnit();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', symbol: '' });

  const submit = async () => {
    if (!form.name.trim() || !form.symbol.trim()) return;
    await createMut.mutateAsync({ name: form.name.trim(), symbol: form.symbol.trim() });
    setForm({ name: '', symbol: '' });
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Ruler className="h-5 w-5" /> Units of Measurement
          </h1>
          <p className="text-muted-foreground">Manage inventory units (kg, g, litre, ml, pcs…)</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Unit</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-8">Loading…</TableCell></TableRow>}
              {!isLoading && (!units || units.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No units defined</TableCell></TableRow>
              )}
              {units?.map(u => (
                <TableRow key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell><Badge variant="outline">{u.symbol}</Badge></TableCell>
                  <TableCell>
                    {u.is_active
                      ? <Badge>Active</Badge>
                      : <Badge variant="outline">Inactive</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      {u.is_active ? (
                        <Button size="icon" variant="ghost" onClick={() => {
                          if (confirm(`Deactivate "${u.name}"? Existing stock items keep their unit.`)) deleteMut.mutate(u.id);
                        }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => updateMut.mutate({ id: u.id, is_active: true })}>
                          Restore
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Unit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bag" />
            </div>
            <div>
              <Label>Symbol</Label>
              <Input value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} placeholder="e.g. bag" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.name || !form.symbol || createMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
