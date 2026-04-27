import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Plus, Minus, ShoppingCart, Loader2, Check, MapPin, User, LogOut, Receipt as ReceiptIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface CartItem { id: string; name: string; price: number; quantity: number; }
interface Branch { id: string; code: string; name: string; address?: string | null; }
interface PendingOrder { order_id: string; order_number: string; branch_name: string; }

const SHOP_BRANCH_KEY = 'shop_active_branch_code';

export default function ShopPage() {
  const [params] = useSearchParams();
  const branchFromUrl = params.get('branch');

  // ---------- Branch resolution ----------
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [activeBranchCode, setActiveBranchCode] = useState<string | null>(() => {
    return branchFromUrl || sessionStorage.getItem(SHOP_BRANCH_KEY);
  });

  // ---------- Auth ----------
  const [user, setUser] = useState<any>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // ---------- Menu / cart ----------
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<PendingOrder | null>(null);

  // ---------- Order tracking ----------
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [myOrders, setMyOrders] = useState<any[]>([]);

  // Load all branches on mount (public — RLS already allows authenticated read; for the public shop we
  // call the public-menu function for menu data and just need branch list for the selector)
  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/branches?select=id,code,name,address&is_active=eq.true&order=name`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
      .then(r => r.json())
      .then((rows: Branch[]) => { setBranches(Array.isArray(rows) ? rows : []); })
      .catch(() => { /* RLS may block anon — fall back to empty list */ })
      .finally(() => setBranchesLoading(false));
  }, []);

  // Persist branch + lock for session
  useEffect(() => {
    if (activeBranchCode) sessionStorage.setItem(SHOP_BRANCH_KEY, activeBranchCode);
  }, [activeBranchCode]);

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.user_metadata?.full_name) setName(session.user.user_metadata.full_name);
      if (session?.user?.user_metadata?.phone) setPhone(session.user.user_metadata.phone);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  // Load menu when branch is selected
  useEffect(() => {
    if (!activeBranchCode) { setLoading(false); return; }
    setLoading(true);
    fetch(`${SUPABASE_URL}/functions/v1/public-menu?branch=${activeBranchCode}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { toast.error('Could not load menu'); setLoading(false); });
  }, [activeBranchCode]);

  // Load my orders when logged in (for tracking)
  const loadMyOrders = useCallback(async () => {
    if (!user) return;
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!customer) { setMyOrders([]); return; }
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, status, total, created_at, branch_id, order_type')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setMyOrders(orders || []);
  }, [user]);

  useEffect(() => { loadMyOrders(); }, [loadMyOrders]);

  // Realtime: refresh tracking when status changes
  useEffect(() => {
    if (!user || !myOrders.length) return;
    const channel = supabase
      .channel('shop-orders')
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders' },
          () => { loadMyOrders(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, myOrders.length, loadMyOrders]);

  const items = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((i: any) =>
      i.is_available !== false &&
      (!selectedCat || i.category_id === selectedCat) &&
      (!search || i.name.toLowerCase().includes(search.toLowerCase())),
    );
  }, [data, search, selectedCat]);

  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  const add = (it: any) => {
    setCart(p => {
      const ex = p.find(c => c.id === it.id);
      if (ex) return p.map(c => c.id === it.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...p, { id: it.id, name: it.name, price: Number(it.price), quantity: 1 }];
    });
  };
  const update = (id: string, d: number) =>
    setCart(p => p.flatMap(c => c.id === id ? (c.quantity + d <= 0 ? [] : [{ ...c, quantity: c.quantity + d }]) : [c]));

  const handleSelectBranch = (code: string) => {
    if (cart.length && activeBranchCode && code !== activeBranchCode) {
      if (!confirm('Switching branches will clear your cart. Continue?')) return;
      setCart([]);
    }
    setActiveBranchCode(code);
  };

  const handleAuth = async () => {
    if (!authEmail || !authPassword) { toast.error('Email and password required'); return; }
    if (authMode === 'register' && (!authName || !authPhone)) { toast.error('Name and phone required'); return; }
    setAuthSubmitting(true);
    try {
      if (authMode === 'register') {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/shop`,
            data: {
              full_name: authName,
              phone: authPhone,
              is_customer: 'true',
              branch_id: branches.find(b => b.code === activeBranchCode)?.id || '',
            },
          },
        });
        if (error) throw error;
        toast.success('Check your email to confirm your account, then log in.');
        setAuthMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        toast.success('Logged in');
        setAuthDialogOpen(false);
      }
      setAuthPassword('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMyOrders([]);
    toast.info('Logged out');
  };

  const placeOrder = async () => {
    if (!cart.length) return;
    if (!activeBranchCode) { toast.error('Choose a branch first'); return; }
    if (!name || !phone) { toast.error('Enter your name and phone'); return; }
    if (orderType === 'delivery' && !address) { toast.error('Delivery address required'); return; }
    setSubmitting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token || SUPABASE_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          branch_code: activeBranchCode,
          order_type: orderType,
          customer_name: name || null,
          customer_phone: phone || null,
          customer_address: orderType === 'delivery' ? address || null : null,
          subtotal: total,
          total,
          items: cart.map(c => ({
            menu_item_id: c.id,
            item_name: c.name,
            quantity: c.quantity,
            unit_price: c.price,
            total_price: c.price * c.quantity,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Order failed');
      setSuccess({ order_id: json.order_id, order_number: json.order_number, branch_name: json.branch_name });
      setCart([]);
      setAddress('');
      loadMyOrders();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Render: branch selector ----------
  if (!activeBranchCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 space-y-4">
            <div className="text-center space-y-1">
              <MapPin className="h-10 w-10 mx-auto text-primary" />
              <h1 className="text-xl font-display font-bold">Choose Your Location</h1>
              <p className="text-sm text-muted-foreground">All orders are tied to a specific branch.</p>
            </div>
            {branchesLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" /></div>
            ) : branches.length ? (
              <div className="space-y-2">
                {branches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBranch(b.code)}
                    className="w-full text-left p-3 rounded-lg border border-border bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    <p className="font-medium">{b.name}</p>
                    {b.address && <p className="text-xs text-muted-foreground mt-1">{b.address}</p>}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">No branches available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="animate-spin text-primary" />
    </div>
  );

  // ---------- Render: success ----------
  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-12 text-center space-y-4">
          <div className="h-16 w-16 mx-auto rounded-full bg-primary flex items-center justify-center">
            <Check className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-display font-bold">Order Placed!</h2>
          <p className="text-muted-foreground">Order #{success.order_number}</p>
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            Awaiting cashier approval at {success.branch_name}
          </Badge>
          <p className="text-sm text-muted-foreground">
            A cashier will review your order shortly. You'll see real-time status here.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setSuccess(null)}>Order More</Button>
            <Button className="flex-1" onClick={() => { setSuccess(null); setTrackingOpen(true); }}>
              Track Order
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const branchName = data?.branch?.name || branches.find(b => b.code === activeBranchCode)?.name || 'SBJ Foods & Drinks';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex justify-between items-center gap-2">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-lg truncate">{branchName}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Online ordering</span>
              <button className="underline" onClick={() => { sessionStorage.removeItem(SHOP_BRANCH_KEY); setActiveBranchCode(null); setData(null); setCart([]); }}>
                Change location
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {user && myOrders.length > 0 && (
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setTrackingOpen(true)}>
                <ReceiptIcon className="h-4 w-4 mr-1" /> My Orders
              </Button>
            )}
            {user ? (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} title="Log out">
                <LogOut className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setAuthDialogOpen(true)}>
                <User className="h-4 w-4 mr-1" /> Sign in
              </Button>
            )}
            <Badge variant="outline" className="gap-1"><ShoppingCart className="h-3 w-3" />{cart.length}</Badge>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full p-4 flex-1 space-y-4">
        <Input placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)} />
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            <Button size="sm" variant={!selectedCat ? 'default' : 'outline'} onClick={() => setSelectedCat(null)}>All</Button>
            {data?.categories?.map((c: any) => (
              <Button key={c.id} size="sm" variant={selectedCat === c.id ? 'default' : 'outline'} onClick={() => setSelectedCat(c.id)} className="whitespace-nowrap">{c.name}</Button>
            ))}
          </div>
        </ScrollArea>

        <div className="grid grid-cols-2 gap-3">
          {items.map((it: any) => (
            <Card key={it.id} className="bg-card border-border">
              {it.image_url && <img src={it.image_url} alt={it.name} className="w-full h-28 object-cover rounded-t-lg" />}
              <CardContent className="p-3 space-y-2">
                <p className="font-medium text-sm">{it.name}</p>
                <p className="text-primary font-bold">₦{Number(it.price).toLocaleString()}</p>
                <Button size="sm" className="w-full" onClick={() => add(it)}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </CardContent>
            </Card>
          ))}
          {!items.length && <p className="col-span-full text-center text-sm text-muted-foreground py-8">No items match your search.</p>}
        </div>
      </div>

      {cart.length > 0 && (
        <div className="sticky bottom-0 bg-card border-t border-border p-4 space-y-3">
          <div className="max-w-3xl mx-auto space-y-2">
            {cart.map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="flex-1 truncate">{c.name}</span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => update(c.id, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center">{c.quantity}</span>
                  <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => update(c.id, 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <span className="ml-3 font-semibold w-20 text-right">₦{(c.price * c.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              {(['takeaway', 'delivery'] as const).map(t => (
                <Button key={t} size="sm" className="flex-1" variant={orderType === t ? 'default' : 'outline'} onClick={() => setOrderType(t)}>
                  {t === 'takeaway' ? 'Takeaway' : 'Delivery'}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
              <Input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            {orderType === 'delivery' && (
              <Input placeholder="Delivery address" value={address} onChange={e => setAddress(e.target.value)} />
            )}
            <Button className="w-full h-12 text-base" disabled={submitting} onClick={placeOrder}>
              {submitting ? <Loader2 className="animate-spin" /> : `Place Order · ₦${total.toLocaleString()}`}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              Your order will be reviewed by a cashier before being prepared.
            </p>
          </div>
        </div>
      )}

      {/* Auth Dialog */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</DialogTitle>
            <DialogDescription>Save details and track your orders.</DialogDescription>
          </DialogHeader>
          <Tabs value={authMode} onValueChange={v => setAuthMode(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Log in</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="space-y-3 pt-3">
              <div><Label>Email</Label><Input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} /></div>
              <div><Label>Password</Label><Input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} /></div>
            </TabsContent>
            <TabsContent value="register" className="space-y-3 pt-3">
              <div><Label>Full name</Label><Input value={authName} onChange={e => setAuthName(e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={authPhone} onChange={e => setAuthPhone(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} /></div>
              <div><Label>Password</Label><Input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} /></div>
            </TabsContent>
          </Tabs>
          <Button onClick={handleAuth} disabled={authSubmitting}>
            {authSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (authMode === 'login' ? 'Log in' : 'Create account')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Order Tracking Dialog */}
      <Dialog open={trackingOpen} onOpenChange={setTrackingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>My Orders</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2">
              {myOrders.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No orders yet</p>}
              {myOrders.map(o => (
                <Card key={o.id} className="bg-secondary border-border">
                  <CardContent className="p-3 text-sm space-y-1">
                    <div className="flex justify-between items-start">
                      <p className="font-medium">{o.order_number}</p>
                      <Badge variant={
                        o.status === 'completed' ? 'default'
                        : o.status === 'cancelled' ? 'destructive'
                        : 'secondary'
                      }>{String(o.status).replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                    <p className="font-semibold text-primary">₦{Number(o.total).toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
