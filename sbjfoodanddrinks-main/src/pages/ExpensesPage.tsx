import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, EXPENSE_CATEGORIES } from '@/hooks/useExpenses';
import { useBranches } from '@/hooks/useBranches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit, Receipt, TrendingDown, Calendar } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';

const CATEGORY_COLORS: Record<string, string> = {
  fuel: 'bg-orange-500/10 text-orange-600',
  electricity: 'bg-yellow-500/10 text-yellow-600',
  rent: 'bg-blue-500/10 text-blue-600',
  salary: 'bg-purple-500/10 text-purple-600',
  transport: 'bg-cyan-500/10 text-cyan-600',
  maintenance: 'bg-pink-500/10 text-pink-600',
  supplies: 'bg-emerald-500/10 text-emerald-600',
  marketing: 'bg-indigo-500/10 text-indigo-600',
  others: 'bg-muted text-muted-foreground',
};

export default function ExpensesPage() {
  const { branchId, role } = useAuth();
  const { data: branches } = useBranches();
  const isAdmin = role === 'admin';

  const [selectedBranch, setSelectedBranch] = useState<string>('current');
  const activeBranch = selectedBranch === 'current' ? branchId : selectedBranch;
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: expenses, isLoading } = useExpenses(activeBranch, dateFrom, dateTo);
  const createMut = useCreateExpense();
  const updateMut = useUpdateExpense();
  const deleteMut = useDeleteExpense();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: '', category: 'others', description: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
  });

  const totals = useMemo(() => {
    const total = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
    const byCategory: Record<string, number> = {};
    (expenses || []).forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    });
    const topCategories = Object.entries(byCategory)
      .map(([cat, amt]) => ({ cat, amt }))
      .sort((a, b) => b.amt - a.amt);
    return { total, topCategories, count: expenses?.length || 0 };
  }, [expenses]);

  const resetForm = () => {
    setForm({ amount: '', category: 'others', description: '', expense_date: format(new Date(), 'yyyy-MM-dd') });
    setEditId(null);
  };

  const openEdit = (e: any) => {
    setEditId(e.id);
    setForm({
      amount: String(e.amount),
      category: e.category,
      description: e.description || '',
      expense_date: e.expense_date,
    });
    setOpen(true);
  };

  const submit = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return;
    if (editId) {
      await updateMut.mutateAsync({
        id: editId, amount, category: form.category,
        description: form.description, expense_date: form.expense_date,
      });
    } else {
      await createMut.mutateAsync({
        amount, category: form.category,
        description: form.description, expense_date: form.expense_date,
        branch_id: activeBranch || undefined,
      });
    }
    setOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Expenses</h1>
          <p className="text-muted-foreground">Track operating costs that affect Net Profit</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Expense
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {isAdmin && (
          <div>
            <Label className="text-xs text-muted-foreground">Branch</Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Branch</SelectItem>
                {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px]" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><TrendingDown className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-xl font-bold">₦{totals.total.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Receipt className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Entries</p>
                <p className="text-xl font-bold">{totals.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent"><Calendar className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Top Category</p>
                <p className="text-xl font-bold capitalize">
                  {totals.topCategories[0]?.cat || '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By Category breakdown */}
      {totals.topCategories.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">By Category</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {totals.topCategories.map(({ cat, amt }) => (
                <Badge key={cat} variant="outline" className={`${CATEGORY_COLORS[cat] || ''} text-xs`}>
                  {cat}: ₦{amt.toLocaleString()}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8">Loading…</TableCell></TableRow>}
              {!isLoading && (!expenses || expenses.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No expenses recorded</TableCell></TableRow>
              )}
              {expenses?.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{format(new Date(e.expense_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${CATEGORY_COLORS[e.category] || ''} capitalize text-xs`}>
                      {e.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{e.description || '—'}</TableCell>
                  <TableCell className="text-right font-bold text-destructive">
                    ₦{Number(e.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Edit className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => {
                        if (confirm('Delete this expense?')) deleteMut.mutate(e.id);
                      }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
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
          <DialogHeader><DialogTitle>{editId ? 'Edit' : 'Add'} Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount (₦)</Label>
              <Input type="number" min="0" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.expense_date}
                onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Diesel refill for generator" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.amount || createMut.isPending || updateMut.isPending}>
              {editId ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
