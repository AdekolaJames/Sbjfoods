import { useState, useRef } from 'react';
import { useMenuItems, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem } from '@/hooks/useMenuItems';
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { useBranches } from '@/hooks/useBranches';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Search, UtensilsCrossed, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MenuPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: branches } = useBranches();
  const { data: categories } = useMenuCategories();
  const branchFilter = selectedBranch === 'all' ? undefined : selectedBranch;
  const catFilter = selectedCategory === 'all' ? undefined : selectedCategory;
  const { data: items, isLoading } = useMenuItems(branchFilter, catFilter);
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();

  const [form, setForm] = useState({
    name: '', category_id: '', price: '', description: '', prep_time: '',
    branch_id: '', is_available: true, display_order: 0, image_url: '',
  });

  const resetForm = () => {
    setForm({ name: '', category_id: '', price: '', description: '', prep_time: '', branch_id: '', is_available: true, display_order: 0, image_url: '' });
    setEditing(null);
    setImagePreview(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('menu-images').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(path);
      setForm(p => ({ ...p, image_url: publicUrl }));
      setImagePreview(publicUrl);
      toast.success('Image uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setForm(p => ({ ...p, image_url: '' }));
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price || !form.branch_id) {
      toast.error('Name, price, and branch are required');
      return;
    }
    try {
      const payload = {
        name: form.name,
        category_id: form.category_id || null,
        price: parseFloat(form.price),
        description: form.description || null,
        prep_time: form.prep_time ? parseInt(form.prep_time) : null,
        branch_id: form.branch_id,
        is_available: form.is_available,
        display_order: form.display_order,
        image_url: form.image_url || null,
      };
      if (editing) {
        await updateItem.mutateAsync({ id: editing, ...payload });
        toast.success('Menu item updated');
      } else {
        await createItem.mutateAsync(payload);
        toast.success('Menu item created');
      }
      resetForm();
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this menu item?')) return;
    try { await deleteItem.mutateAsync(id); toast.success('Item deleted'); } catch (e: any) { toast.error(e.message); }
  };

  const toggleAvailability = async (item: any) => {
    try {
      await updateItem.mutateAsync({ id: item.id, is_available: !item.is_available });
      toast.success(`${item.name} ${item.is_available ? 'marked unavailable' : 'marked available'}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const editItem = (item: any) => {
    setForm({
      name: item.name, category_id: item.category_id || '', price: String(item.price),
      description: item.description || '', prep_time: item.prep_time ? String(item.prep_time) : '',
      branch_id: item.branch_id, is_available: item.is_available, display_order: item.display_order,
      image_url: item.image_url || '',
    });
    setEditing(item.id);
    setImagePreview(item.image_url || null);
    setOpen(true);
  };

  const filtered = items?.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Menu Management</h1>
          <p className="text-muted-foreground mt-1">Manage your food and drink items</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Item</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Menu Item</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Image Upload */}
              <div>
                <Label>Image</Label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                {imagePreview ? (
                  <div className="relative mt-2 rounded-lg overflow-hidden border border-border">
                    <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover" />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-3 w-3" />
                      </Button>
                      <Button variant="destructive" size="icon" className="h-7 w-7" onClick={removeImage}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full mt-2 h-24 border-dashed" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Click to upload image</span>
                      </div>
                    )}
                  </Button>
                )}
              </div>

              <div><Label>Item Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Jollof Rice" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Price (₦)</Label><Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="1500" /></div>
              </div>
              <div>
                <Label>Branch</Label>
                <Select value={form.branch_id} onValueChange={v => setForm(p => ({ ...p, branch_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>{branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Served hot with stew" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Prep Time (min)</Label><Input type="number" value={form.prep_time} onChange={e => setForm(p => ({ ...p, prep_time: e.target.value }))} /></div>
                <div><Label>Display Order</Label><Input type="number" value={form.display_order} onChange={e => setForm(p => ({ ...p, display_order: parseInt(e.target.value) || 0 }))} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.is_available} onCheckedChange={v => setForm(p => ({ ...p, is_available: v }))} /><Label>Available</Label></div>
              <Button className="w-full" onClick={handleSubmit}>{editing ? 'Update' : 'Create'} Item</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-3">

  {/* SEARCH */}
  <div className="flex items-center gap-2">
    <Search className="h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Search menu..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="w-48"
    />
  </div>

  {/* BRANCH FILTER */}
  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
    <SelectTrigger className="w-48">
      <SelectValue placeholder="All Branches" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Branches</SelectItem>
      {branches?.map((b) => (
        <SelectItem key={b.id} value={b.id}>
          {b.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* CATEGORY FILTER */}
  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
    <SelectTrigger className="w-48">
      <SelectValue placeholder="All Categories" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Categories</SelectItem>
      {categories?.map((c) => (
        <SelectItem key={c.id} value={c.id}>
          {c.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

</div>

      {/* Menu Grid */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading menu items...</p>
      ) : filtered?.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center py-12 space-y-3">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No menu items found. Add your first item!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered?.map(item => (
            <Card key={item.id} className="bg-card border-border overflow-hidden">
              <div className="h-32 bg-muted flex items-center justify-center">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold font-display">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">{item.menu_categories?.name || 'Uncategorized'}</p>
                  </div>
                  <p className="text-lg font-bold text-primary font-display">₦{Number(item.price).toLocaleString()}</p>
                </div>
                {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Switch checked={item.is_available} onCheckedChange={() => toggleAvailability(item)} />
                    <Badge variant={item.is_available ? 'default' : 'secondary'} className="text-xs">{item.is_available ? 'Available' : 'Sold Out'}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editItem(item)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
