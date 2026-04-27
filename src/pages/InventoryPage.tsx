import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMenuItems } from '@/hooks/useMenuItems';
import { usePermissionCheck } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Package, Plus, AlertTriangle, ArrowUpDown, History, Trash2, Edit, ChevronDown, ChevronRight, TrendingUp, EyeOff } from 'lucide-react';
import { StockPurchaseDialog } from '@/components/inventory/StockPurchaseDialog';
import { EditStockItemDialog } from '@/components/inventory/EditStockItemDialog';
import { StockHistoryDialog } from '@/components/inventory/StockHistoryDialog';

interface IngredientRow {
  stock_item_id: string;
  quantity_needed: string;
  unit: string;
}

export default function InventoryPage() {
  const { user, branchId } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: 'general', quantity: '0', unit: 'pc', unit_cost: '0', low_stock_threshold: '5', supplier: '', sub_unit: '', conversion_rate: '1' });
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustAction, setAdjustAction] = useState('add');
  const [adjustReason, setAdjustReason] = useState('');

  // New dialogs (purchase / edit / history)
  const [purchaseDialog, setPurchaseDialog] = useState<{ id: string; name: string; avgCost: number } | null>(null);
  const [editDialog, setEditDialog] = useState<any | null>(null);
  const [historyDialog, setHistoryDialog] = useState<{ id: string; name: string } | null>(null);

  // Recipe state
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [editingRecipeMenuItemId, setEditingRecipeMenuItemId] = useState<string | null>(null);
  const [recipeMenuItemId, setRecipeMenuItemId] = useState('');
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([{ stock_item_id: '', quantity_needed: '', unit: 'pc' }]);
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);

  // Permission gating — admin always passes; others use role_permissions
  const { can, isAdmin } = usePermissionCheck();
  const canAddStock = isAdmin || can('add_stock');
  const canEditStock = isAdmin || can('edit_stock');
  const canDeleteStock = isAdmin; // delete restricted to admins per requirements

  const { data: menuItems } = useMenuItems(branchId);

  const { data: stockItems, isLoading } = useQuery({
    queryKey: ['stock-items', branchId],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_items').select('*').eq('branch_id', branchId!).eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  const { data: movements } = useQuery({
    queryKey: ['stock-movements', branchId],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_movements').select('*, stock_items(name)').eq('branch_id', branchId!).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  const { data: recipes } = useQuery({
    queryKey: ['recipe-ingredients', branchId],
    queryFn: async () => {
      const { data, error } = await supabase.from('recipe_ingredients').select('*, menu_items(name, branch_id), stock_items(name, unit)');
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  // Group recipes by menu_item_id
  const groupedRecipes = useMemo(() => {
    if (!recipes) return [];
    const map: Record<string, { menuItemId: string; menuItemName: string; ingredients: typeof recipes }> = {};
    for (const r of recipes) {
      const mi = (r as any).menu_items;
      if (!mi) continue;
      // Filter to current branch
      if (mi.branch_id !== branchId) continue;
      if (!map[r.menu_item_id]) {
        map[r.menu_item_id] = { menuItemId: r.menu_item_id, menuItemName: mi.name, ingredients: [] };
      }
      map[r.menu_item_id].ingredients.push(r);
    }
    return Object.values(map);
  }, [recipes, branchId]);

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('stock_items').insert({
        name: form.name, category: form.category, quantity: Number(form.quantity),
        unit: form.unit, unit_cost: Number(form.unit_cost),
        low_stock_threshold: Number(form.low_stock_threshold),
        supplier: form.supplier || null, branch_id: branchId!,
        base_unit: form.unit,
        sub_unit: form.sub_unit || null,
        conversion_rate: Number(form.conversion_rate) || 1,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-items'] });
      setAddOpen(false);
      setForm({ name: '', category: 'general', quantity: '0', unit: 'pc', unit_cost: '0', low_stock_threshold: '5', supplier: '', sub_unit: '', conversion_rate: '1' });
      toast.success('Stock item added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const adjustStock = useMutation({
    mutationFn: async (itemId: string) => {
      const qty = Number(adjustQty);
      if (!qty || qty <= 0) throw new Error('Enter a valid quantity');
      const item = stockItems?.find(i => i.id === itemId);
      if (!item) throw new Error('Item not found');
      const newQty = adjustAction === 'add' ? item.quantity + qty : Math.max(0, item.quantity - qty);
      const { error: moveErr } = await supabase.from('stock_movements').insert({
        stock_item_id: itemId, branch_id: branchId!, staff_id: user!.id,
        action: adjustAction, quantity: qty, reason: adjustReason || null,
      });
      if (moveErr) throw moveErr;
      const { error: updateErr } = await supabase.from('stock_items').update({ quantity: newQty }).eq('id', itemId);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-items'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      setAdjustOpen(null);
      setAdjustQty('');
      setAdjustReason('');
      toast.success('Stock adjusted');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Soft delete (admin-only) — preserves history & past sales
  const deleteStockItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('stock_items').update({ is_active: false }).eq('id', itemId);
      if (error) throw error;
      await supabase.from('audit_logs').insert({
        user_id: user!.id, user_name: user!.email,
        action: 'stock_item.delete', entity_type: 'stock_item', entity_id: itemId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-items'] });
      toast.success('Stock item archived (soft-deleted). History preserved.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Recipe mutations
  const saveRecipe = useMutation({
    mutationFn: async () => {
      if (!recipeMenuItemId) throw new Error('Select a menu item');
      const validRows = ingredientRows.filter(r => r.stock_item_id && Number(r.quantity_needed) > 0);
      if (!validRows.length) throw new Error('Add at least one ingredient');

      // If editing, delete old ingredients first
      if (editingRecipeMenuItemId) {
        const { error: delErr } = await supabase.from('recipe_ingredients').delete().eq('menu_item_id', editingRecipeMenuItemId);
        if (delErr) throw delErr;
      }

      const { error } = await supabase.from('recipe_ingredients').insert(
        validRows.map(r => ({
          menu_item_id: recipeMenuItemId,
          stock_item_id: r.stock_item_id,
          quantity_needed: Number(r.quantity_needed),
          unit: r.unit,
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipe-ingredients'] });
      setRecipeOpen(false);
      resetRecipeForm();
      toast.success(editingRecipeMenuItemId ? 'Recipe updated' : 'Recipe saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRecipe = useMutation({
    mutationFn: async (menuItemId: string) => {
      const { error } = await supabase.from('recipe_ingredients').delete().eq('menu_item_id', menuItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipe-ingredients'] });
      toast.success('Recipe deleted');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetRecipeForm = () => {
    setRecipeMenuItemId('');
    setIngredientRows([{ stock_item_id: '', quantity_needed: '', unit: 'pc' }]);
    setEditingRecipeMenuItemId(null);
  };

  const openEditRecipe = (group: typeof groupedRecipes[0]) => {
    setEditingRecipeMenuItemId(group.menuItemId);
    setRecipeMenuItemId(group.menuItemId);
    setIngredientRows(
      group.ingredients.map(ing => ({
        stock_item_id: ing.stock_item_id,
        quantity_needed: String(ing.quantity_needed),
        unit: ing.unit,
      }))
    );
    setRecipeOpen(true);
  };

  const addIngredientRow = () => {
    setIngredientRows(prev => [...prev, { stock_item_id: '', quantity_needed: '', unit: 'pc' }]);
  };

  const removeIngredientRow = (idx: number) => {
    setIngredientRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateIngredientRow = (idx: number, field: keyof IngredientRow, value: string) => {
    setIngredientRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  // Menu items that don't have a recipe yet (for new recipes)
  const availableMenuItems = useMemo(() => {
    if (!menuItems) return [];
    const recipeMenuIds = new Set(groupedRecipes.map(g => g.menuItemId));
    if (editingRecipeMenuItemId) recipeMenuIds.delete(editingRecipeMenuItemId);
    return menuItems.filter(mi => !recipeMenuIds.has(mi.id));
  }, [menuItems, groupedRecipes, editingRecipeMenuItemId]);

  const lowStockItems = stockItems?.filter(i => i.quantity <= i.low_stock_threshold) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Inventory</h1>
          <p className="text-muted-foreground">Manage stock items, movements, and recipes</p>
        </div>
        {canAddStock && <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>}
      </div>

      {lowStockItems.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Low Stock Alerts ({lowStockItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(item => (
                <Badge key={item.id} variant="destructive" className="text-xs">
                  {item.name}: {item.quantity} {item.unit} (min: {item.low_stock_threshold})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock"><Package className="h-4 w-4 mr-1" /> Stock Items</TabsTrigger>
          <TabsTrigger value="movements"><History className="h-4 w-4 mr-1" /> Movements</TabsTrigger>
          <TabsTrigger value="recipes"><ArrowUpDown className="h-4 w-4 mr-1" /> Recipes</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Avg Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockItems?.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>₦{Number((item as any).average_cost ?? item.unit_cost).toLocaleString()}</TableCell>
                      <TableCell>
                        {item.quantity === 0 ? (
                          <Badge variant="destructive">Out</Badge>
                        ) : item.quantity <= item.low_stock_threshold ? (
                          <Badge variant="destructive">Low</Badge>
                        ) : (
                          <Badge className="bg-green-600">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {canAddStock && (
                            <Button size="sm" variant="default" className="h-7 text-xs"
                              onClick={() => setPurchaseDialog({ id: item.id, name: item.name, avgCost: Number((item as any).average_cost ?? item.unit_cost) })}>
                              <TrendingUp className="h-3 w-3 mr-1" /> Purchase
                            </Button>
                          )}
                          {canEditStock && (
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => { setAdjustOpen(item.id); setAdjustAction('add'); }}>
                              Adjust
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2"
                            title="History" onClick={() => setHistoryDialog({ id: item.id, name: item.name })}>
                            <History className="h-3 w-3" />
                          </Button>
                          {canEditStock && (
                            <Button size="sm" variant="ghost" className="h-7 px-2"
                              title="Edit" onClick={() => setEditDialog(item)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          {canDeleteStock && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" title="Archive">
                                  <EyeOff className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Archive {item.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This soft-deletes the item — it disappears from the inventory list but
                                    purchase history, movements and past sales remain intact for reporting.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteStockItem.mutate(item.id)}
                                  >
                                    Archive
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!stockItems || stockItems.length === 0) && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No stock items</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements?.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{new Date(m.created_at).toLocaleString()}</TableCell>
                      <TableCell>{(m as any).stock_items?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={m.action === 'add' ? 'default' : 'destructive'}>{m.action}</Badge>
                      </TableCell>
                      <TableCell>{m.quantity}</TableCell>
                      <TableCell className="text-xs">{m.reason || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {(!movements || movements.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No movements</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Recipes</CardTitle>
              <Button size="sm" onClick={() => { resetRecipeForm(); setRecipeOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Recipe
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {groupedRecipes.length > 0 ? (
                <div className="divide-y divide-border">
                  {groupedRecipes.map(group => (
                    <div key={group.menuItemId}>
                      <button
                        className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors text-left"
                        onClick={() => setExpandedRecipe(prev => prev === group.menuItemId ? null : group.menuItemId)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedRecipe === group.menuItemId ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <div>
                            <p className="font-medium text-sm">{group.menuItemName}</p>
                            <p className="text-xs text-muted-foreground">{group.ingredients.length} ingredient{group.ingredients.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={e => { e.stopPropagation(); openEditRecipe(group); }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={e => { e.stopPropagation(); deleteRecipe.mutate(group.menuItemId); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </button>
                      {expandedRecipe === group.menuItemId && (
                        <div className="px-4 pb-4 pl-11">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Ingredient</TableHead>
                                <TableHead className="text-xs">Qty Needed</TableHead>
                                <TableHead className="text-xs">Unit</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.ingredients.map(ing => (
                                <TableRow key={ing.id}>
                                  <TableCell className="text-sm">{(ing as any).stock_items?.name || '-'}</TableCell>
                                  <TableCell className="text-sm">{ing.quantity_needed}</TableCell>
                                  <TableCell className="text-sm">{ing.unit}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowUpDown className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No recipes configured</p>
                  <p className="text-xs mt-1">Create a recipe to link menu items to stock ingredients</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Stock Item Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Stock Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['general', 'proteins', 'grains', 'oils', 'vegetables', 'spices', 'packaging', 'drinks'].map(c => (
                  <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Quantity" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pc', 'kg', 'g', 'L', 'ml', 'bag', 'crate'].map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Unit Cost (₦)" type="number" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
              <Input placeholder="Low Stock Alert" type="number" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))} />
            </div>
            <Input placeholder="Supplier (optional)" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs text-muted-foreground">Sub-unit (optional, e.g. stock in <b>kg</b>, recipes use <b>g</b>)</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Sub-unit (e.g. g)" value={form.sub_unit} onChange={e => setForm(f => ({ ...f, sub_unit: e.target.value }))} />
                <Input placeholder="Conversion (e.g. 1000)" type="number" value={form.conversion_rate} onChange={e => setForm(f => ({ ...f, conversion_rate: e.target.value }))} />
              </div>
              {form.sub_unit && (
                <p className="text-xs text-muted-foreground">1 {form.unit} = {form.conversion_rate || 1} {form.sub_unit}</p>
              )}
            </div>
            <Button className="w-full" onClick={() => addItem.mutate()} disabled={!form.name || addItem.isPending}>Add Item</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={!!adjustOpen} onOpenChange={() => setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={adjustAction} onValueChange={setAdjustAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add Stock</SelectItem>
                <SelectItem value="remove">Remove Stock</SelectItem>
                <SelectItem value="waste">Waste</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Quantity" type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} />
            <Input placeholder="Reason (optional)" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
            <Button className="w-full" disabled={adjustStock.isPending} onClick={() => adjustOpen && adjustStock.mutate(adjustOpen)}>Confirm Adjustment</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipe Create/Edit Dialog */}
      <Dialog open={recipeOpen} onOpenChange={v => { if (!v) { setRecipeOpen(false); resetRecipeForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRecipeMenuItemId ? 'Edit Recipe' : 'Create Recipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Menu Item</label>
              <Select
                value={recipeMenuItemId}
                onValueChange={setRecipeMenuItemId}
                disabled={!!editingRecipeMenuItemId}
              >
                <SelectTrigger><SelectValue placeholder="Select menu item..." /></SelectTrigger>
                <SelectContent>
                  {editingRecipeMenuItemId && menuItems?.filter(mi => mi.id === editingRecipeMenuItemId).map(mi => (
                    <SelectItem key={mi.id} value={mi.id}>{mi.name}</SelectItem>
                  ))}
                  {availableMenuItems.map(mi => (
                    <SelectItem key={mi.id} value={mi.id}>{mi.name} — ₦{Number(mi.price).toLocaleString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Ingredients</label>
                <Button size="sm" variant="outline" onClick={addIngredientRow}><Plus className="h-3 w-3 mr-1" /> Add Row</Button>
              </div>
              <ScrollArea className="max-h-[250px]">
                <div className="space-y-2">
                  {ingredientRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Select value={row.stock_item_id} onValueChange={v => updateIngredientRow(idx, 'stock_item_id', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Stock item..." /></SelectTrigger>
                        <SelectContent>
                          {stockItems?.map(si => (
                            <SelectItem key={si.id} value={si.id}>{si.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="w-20"
                        type="number"
                        placeholder="Qty"
                        value={row.quantity_needed}
                        onChange={e => updateIngredientRow(idx, 'quantity_needed', e.target.value)}
                      />
                      <Select value={row.unit} onValueChange={v => updateIngredientRow(idx, 'unit', v)}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['pc', 'kg', 'g', 'L', 'ml', 'bag'].map(u => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {ingredientRows.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeIngredientRow(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <Button className="w-full" onClick={() => saveRecipe.mutate()} disabled={saveRecipe.isPending || !recipeMenuItemId}>
              {editingRecipeMenuItemId ? 'Update Recipe' : 'Save Recipe'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New: Stock purchase / edit / history dialogs */}
      <StockPurchaseDialog
        stockItemId={purchaseDialog?.id || null}
        itemName={purchaseDialog?.name}
        currentAvgCost={purchaseDialog?.avgCost}
        open={!!purchaseDialog}
        onOpenChange={(o) => !o && setPurchaseDialog(null)}
      />
      <EditStockItemDialog
        item={editDialog}
        open={!!editDialog}
        onOpenChange={(o) => !o && setEditDialog(null)}
      />
      <StockHistoryDialog
        stockItemId={historyDialog?.id || null}
        itemName={historyDialog?.name}
        open={!!historyDialog}
        onOpenChange={(o) => !o && setHistoryDialog(null)}
      />
    </div>
  );
}
