import { useState } from 'react';
import { useMenuCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useMenuCategories';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Tags, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

export default function CategoriesPage() {
  const { data: categories, isLoading } = useMenuCategories();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', sort_order: 0 });

  const resetForm = () => { setForm({ name: '', sort_order: 0 }); setEditing(null); };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Category name is required'); return; }
    try {
      if (editing) {
        await updateCat.mutateAsync({ id: editing, ...form });
        toast.success('Category updated');
      } else {
        await createCat.mutateAsync(form);
        toast.success('Category created');
      }
      resetForm();
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await deleteCat.mutateAsync(id);
      toast.success('Category deleted');
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleActive = async (cat: any) => {
    try {
      await updateCat.mutateAsync({ id: cat.id, is_active: !cat.is_active });
      toast.success(`Category ${cat.is_active ? 'deactivated' : 'activated'}`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Categories</h1>
          <p className="text-muted-foreground mt-1">Organize your menu items</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Category</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Rice Meals" /></div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} /></div>
              <Button className="w-full" onClick={handleSubmit}>{editing ? 'Update' : 'Create'} Category</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : categories?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No categories yet</TableCell></TableRow>
              ) : (
                categories?.map(cat => (
                  <TableRow key={cat.id}>
                    <TableCell><GripVertical className="h-4 w-4 text-muted-foreground" /></TableCell>
                    <TableCell className="font-medium flex items-center gap-2"><Tags className="h-4 w-4 text-primary" />{cat.name}</TableCell>
                    <TableCell className="text-muted-foreground">{cat.sort_order}</TableCell>
                    <TableCell><Badge variant={cat.is_active ? 'default' : 'secondary'}>{cat.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell><Switch checked={cat.is_active} onCheckedChange={() => toggleActive(cat)} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setForm({ name: cat.name, sort_order: cat.sort_order }); setEditing(cat.id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
