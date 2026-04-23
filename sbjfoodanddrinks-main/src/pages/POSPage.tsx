import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMenuItems } from '@/hooks/useMenuItems';
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { useAddons } from '@/hooks/useAddons';
import { useCreateOrder, useCreatePayment, useOrders } from '@/hooks/useOrders';
import { useBranches } from '@/hooks/useBranches';
import { useCustomerByPhone, useUpsertCustomer } from '@/hooks/useCustomers';
import { useOfflineSync, saveMenuCache, loadMenuCache } from '@/hooks/useOfflineSync';
import { usePermissionCheck } from '@/hooks/usePermissions';
import { ReceiptDialog } from '@/components/ReceiptDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, X,
  UtensilsCrossed, Pause, Play, WifiOff, Percent, Bell, Check
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
  addons: { id: string; name: string; price: number; quantity: number }[];
}

type OrderType = 'takeaway' | 'delivery';

export default function POSPage() {
  const { user, branchId, profile } = useAuth();
  const { data: branches } = useBranches();
  const activeBranchId = branchId;

  const { data: categories } = useMenuCategories(activeBranchId);
  const { data: menuItems } = useMenuItems(activeBranchId);
  const { data: addons } = useAddons(activeBranchId);
  const { data: heldOrders } = useOrders(activeBranchId, ['pending']);
  const { data: incomingOrders } = useOrders(activeBranchId, ['pending_approval']);
  const createOrder = useCreateOrder();
  const createPayment = useCreatePayment();
  const upsertCustomer = useUpsertCustomer();
  const { isOnline, pendingCount, saveOfflineOrder, getPendingOrders, removeOrder, updateOrder, setSyncing, syncing } = useOfflineSync();
  const qc = useQueryClient();
  const { can, isAdmin } = usePermissionCheck();
  const canDiscount = isAdmin || can('apply_discount');
  const canCancelOrder = isAdmin || can('cancel_order');

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [addonDialogItem, setAddonDialogItem] = useState<CartItem | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [splitPayments, setSplitPayments] = useState<{ method: string; amount: string }[]>([]);
  const [isSplit, setIsSplit] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [incomingDialogOpen, setIncomingDialogOpen] = useState(false);
  // VAT/Discount/Receipt state
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [enableVAT, setEnableVAT] = useState(false);
  const [serviceChargePercent, setServiceChargePercent] = useState('');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Customer auto-fill
  const { data: foundCustomer } = useCustomerByPhone(customerPhone, activeBranchId);
  useEffect(() => {
    if (foundCustomer) {
      setCustomerName(foundCustomer.name);
      if (foundCustomer.address) setCustomerAddress(foundCustomer.address);
    }
  }, [foundCustomer]);

  // Cache menu data locally for offline use & hydrate from cache when offline
  const [cachedMenu, setCachedMenu] = useState<{ categories?: any[]; items?: any[]; addons?: any[] }>({});
  useEffect(() => {
    if (!activeBranchId) return;
    if (isOnline && categories?.length && menuItems?.length) {
      saveMenuCache(activeBranchId, {
        categories: categories || [],
        items: menuItems || [],
        addons: addons || [],
      });
    } else if (!isOnline) {
      const cache = loadMenuCache(activeBranchId);
      if (cache) setCachedMenu({ categories: cache.categories, items: cache.items, addons: cache.addons });
    }
  }, [isOnline, activeBranchId, categories, menuItems, addons]);

  const effectiveCategories = isOnline ? categories : (categories?.length ? categories : cachedMenu.categories);
  const effectiveMenuItems = isOnline ? menuItems : (menuItems?.length ? menuItems : cachedMenu.items);
  const effectiveAddons = isOnline ? addons : (addons?.length ? addons : cachedMenu.addons);

  // ============================================================
  // OFFLINE SYNC: Auto-trigger on reconnect + periodic retry
  // ============================================================
  const syncOfflineOrders = useCallback(async () => {
    const pending = await getPendingOrders();
    if (!pending.length) return;
    setSyncing(true);
    let successCount = 0;
    let failCount = 0;

    for (const stored of pending) {
      try {
        // Generate a real order number now that we're online
        const branchForOrder = branches?.find(b => b.id === stored.branchId);
        if (!branchForOrder) {
          await updateOrder(stored.localId, { syncFailed: true, lastError: 'Branch not found' });
          failCount++;
          continue;
        }

        const payload = JSON.parse(JSON.stringify(stored.payload));
        // Ensure offline_id is set on the order for duplicate prevention
        payload.order.offline_id = stored.localId;

        // If the order_number is a placeholder, request a real one
        if (!payload.order.order_number || payload.order.order_number.startsWith('OFFLINE-') || payload.order.order_number.startsWith('DRAFT-')) {
          const { data: orderNum } = await supabase.rpc('generate_order_number', { _branch_code: branchForOrder.code });
          if (orderNum) payload.order.order_number = orderNum;
        }

        const created = await createOrder.mutateAsync(payload);

        // Process payments if present
        if (payload.payments?.length && created?.id) {
          const payments = payload.payments.map((p: any) => ({
            ...p,
            order_id: created.id,
          }));
          try {
            await createPayment.mutateAsync(payments);
          } catch (payErr) {
            console.error('[sync] payment error', payErr);
          }
        }

        // Defensive: ensure inventory deduction runs for synced completed orders.
        // RPC is idempotent — safe even if useCreatePayment.onSuccess already triggered it.
        if (created?.id) {
          try {
            await supabase.rpc('process_inventory_deduction', { _order_id: created.id });
          } catch (invErr) {
            console.error('[sync] inventory deduction error', invErr);
          }
        }

        // Persist customer if needed
        if (payload.customer && payload.customer.phone) {
          try {
            await upsertCustomer.mutateAsync(payload.customer);
          } catch { /* ignore */ }
        }

        await removeOrder(stored.localId);
        successCount++;
      } catch (e: any) {
        console.error('[sync] Sync failed for', stored.localId, e);
        await updateOrder(stored.localId, {
          retries: (stored.retries || 0) + 1,
          syncFailed: true,
          lastError: e?.message || 'Unknown error',
        });
        failCount++;
      }
    }

    setSyncing(false);
    if (successCount > 0) toast.success(`Synced ${successCount} offline order${successCount > 1 ? 's' : ''}`);
    if (failCount > 0) toast.error(`${failCount} offline order${failCount > 1 ? 's' : ''} failed to sync`);
  }, [getPendingOrders, setSyncing, branches, createOrder, createPayment, upsertCustomer, removeOrder, updateOrder]);

  // Trigger sync on reconnect
  useEffect(() => {
    if (isOnline) syncOfflineOrders();
  }, [isOnline, syncOfflineOrders]);

  // Periodic background retry every 45s (only when online and pending exist)
  useEffect(() => {
    if (!isOnline || pendingCount === 0) return;
    const id = setInterval(() => { syncOfflineOrders(); }, 45000);
    return () => clearInterval(id);
  }, [isOnline, pendingCount, syncOfflineOrders]);

  // Sound alert for incoming shop orders (only plays when count grows)
  const prevIncomingRef = useRef(0);
  useEffect(() => {
    const count = incomingOrders?.length || 0;
    if (count > prevIncomingRef.current && prevIncomingRef.current !== 0) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        o.start(); o.stop(ctx.currentTime + 0.4);
        toast.info('🔔 New incoming order from shop!');
      } catch (e) { /* silent */ }
    }
    prevIncomingRef.current = count;
  }, [incomingOrders?.length]);

  const filteredItems = useMemo(() => {
    const source = effectiveMenuItems;
    if (!source) return [];
    return source.filter((i: any) => {
      if (!i.is_available) return false;
      if (selectedCategory && i.category_id !== selectedCategory) return false;
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [effectiveMenuItems, selectedCategory, search]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const addonTotal = item.addons.reduce((a, ad) => a + ad.price * ad.quantity, 0);
      return sum + (item.price + addonTotal) * item.quantity;
    }, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const v = Number(discountValue) || 0;
    if (discountType === 'percentage') return Math.round(cartSubtotal * v / 100);
    return v;
  }, [cartSubtotal, discountValue, discountType]);

  const afterDiscount = cartSubtotal - discountAmount;
  const vatAmount = enableVAT ? Math.round(afterDiscount * 0.075) : 0;
  const serviceCharge = serviceChargePercent ? Math.round(afterDiscount * Number(serviceChargePercent) / 100) : 0;
  const cartTotal = afterDiscount + vatAmount + serviceCharge;

  const addToCart = useCallback((item: { id: string; name: string; price: number }) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id && c.addons.length === 0);
      if (existing) {
        return prev.map(c => c.menuItemId === item.id && c.addons.length === 0 ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: Number(item.price), quantity: 1, notes: '', addons: [] }];
    });
  }, []);

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => prev.map((c, i) => i === index ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAddon = (addon: { id: string; name: string; price: number }) => {
    if (!addonDialogItem) return;
    const idx = cart.findIndex(c => c === addonDialogItem);
    if (idx === -1) return;
    setCart(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      const has = c.addons.find(a => a.id === addon.id);
      if (has) return { ...c, addons: c.addons.filter(a => a.id !== addon.id) };
      return { ...c, addons: [...c.addons, { ...addon, price: Number(addon.price), quantity: 1 }] };
    }));
    setAddonDialogItem(prev => {
      if (!prev) return null;
      const has = prev.addons.find(a => a.id === addon.id);
      if (has) return { ...prev, addons: prev.addons.filter(a => a.id !== addon.id) };
      return { ...prev, addons: [...prev.addons, { ...addon, price: Number(addon.price), quantity: 1 }] };
    });
  };

  const branch = branches?.find(b => b.id === activeBranchId);

  const buildOrderPayload = (status: string, paymentStatus: string) => ({
    order: {
      branch_id: activeBranchId!,
      cashier_id: user!.id,
      order_number: '',
      order_type: orderType,
      table_id: null,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      customer_address: orderType === 'delivery' ? customerAddress || null : null,
      notes: orderNotes || null,
      subtotal: cartSubtotal,
      discount_amount: discountAmount,
      discount_type: discountValue ? discountType : null,
      tax_amount: vatAmount,
      total: cartTotal,
      status,
      payment_status: paymentStatus,
      source: 'pos',
      ...(status === 'completed'
        ? { approved_by: user!.id, approved_at: new Date().toISOString() }
        : {}),
    } as any,
    items: cart.map(c => ({
      menu_item_id: c.menuItemId,
      item_name: c.name,
      quantity: c.quantity,
      unit_price: c.price,
      total_price: (c.price + c.addons.reduce((a, ad) => a + ad.price * ad.quantity, 0)) * c.quantity,
      notes: c.notes || null,
      addons: c.addons.map(a => ({ addon_id: a.id, addon_name: a.name, quantity: a.quantity, unit_price: a.price })),
    })),
  });

  const saveCustomerIfNeeded = async () => {
    if (customerPhone && customerName && activeBranchId) {
      try {
        await upsertCustomer.mutateAsync({
          name: customerName,
          phone: customerPhone,
          address: customerAddress || null,
          branch_id: activeBranchId,
        });
      } catch { /* ignore duplicate errors */ }
    }
  };

  // Approve an incoming pending_approval order (from /shop) → directly to completed (paid status stays unpaid; cashier collects)
  const approveIncoming = async (order: any) => {
    try {
      await supabase
        .from('orders')
        .update({
          // Mark as pending (ready for payment) — cashier still collects payment then completes via order detail
          status: 'pending' as any,
          approved_by: user!.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Order ${order.order_number} approved`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const rejectIncoming = async (order: any) => {
    if (!canCancelOrder) {
      toast.error('You do not have permission to cancel orders');
      return;
    }
    try {
      await supabase
        .from('orders')
        .update({ status: 'cancelled' as any })
        .eq('id', order.id);
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Order ${order.order_number} rejected`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleHoldOrder = async () => {
    if (!cart.length || !user || !activeBranchId || !branch) return;

    if (!isOnline) {
      const payload = buildOrderPayload('pending', 'unpaid');
      payload.order.order_number = `OFFLINE-${Date.now()}`;
      (payload.order as any).is_held = true;
      await saveOfflineOrder(payload, activeBranchId);
      toast.info('Draft saved offline. Will sync when reconnected.');
      resetForm();
      return;
    }

    try {
      const { data: orderNum } = await supabase.rpc('generate_order_number', { _branch_code: branch.code });
      const payload = buildOrderPayload('pending', 'unpaid');
      payload.order.order_number = orderNum || `DRAFT-${Date.now()}`;
      (payload.order as any).is_held = true;
      await createOrder.mutateAsync(payload);
      toast.success('Order held!');
      resetForm();
    } catch (e: any) {
      toast.error(e.message || 'Failed to hold order');
    }
  };

  const handleResumeOrder = (order: any) => {
    const items: CartItem[] = (order.order_items || []).map((oi: any) => ({
      menuItemId: oi.menu_item_id,
      name: oi.item_name,
      price: Number(oi.unit_price),
      quantity: oi.quantity,
      notes: oi.notes || '',
      addons: (oi.order_item_addons || []).map((a: any) => ({
        id: a.addon_id || a.id,
        name: a.addon_name,
        price: Number(a.unit_price),
        quantity: a.quantity,
      })),
    }));
    setCart(items);
    setOrderType((order.order_type === 'delivery' ? 'delivery' : 'takeaway') as OrderType);
    setCustomerName(order.customer_name || '');
    setCustomerPhone(order.customer_phone || '');
    setCustomerAddress(order.customer_address || '');
    setOrderNotes(order.notes || '');
    setResumeDialogOpen(false);
    toast.info(`Resumed order ${order.order_number}`);
  };

  const handleCheckout = async () => {
    if (!cart.length || !user || !activeBranchId || !branch) return;
    if (orderType === 'delivery' && !customerPhone && !customerAddress) {
      toast.error('Phone or address required for delivery');
      return;
    }

    const pMethod = isSplit ? 'split' : paymentMethod;

    // ============================================================
    // OFFLINE CHECKOUT: Save order + payments locally for later sync
    // ============================================================
    if (!isOnline) {
      const payload: any = buildOrderPayload('completed', 'paid');
      payload.order.order_number = `OFFLINE-${Date.now()}`;
      // Stash payments + customer in payload for sync handler
      payload.payments = isSplit
        ? splitPayments.filter(p => Number(p.amount) > 0).map(p => ({
            method: p.method, amount: Number(p.amount),
            branch_id: activeBranchId!, staff_id: user.id, reference: null,
          }))
        : [{ method: paymentMethod, amount: cartTotal,
             branch_id: activeBranchId!, staff_id: user.id, reference: payRef || null }];
      if (customerPhone && customerName) {
        payload.customer = {
          name: customerName,
          phone: customerPhone,
          address: customerAddress || null,
          branch_id: activeBranchId!,
        };
      }

      const localId = await saveOfflineOrder(payload, activeBranchId);

      // Show local receipt immediately
      setReceiptData({
        orderNumber: payload.order.order_number,
        orderType,
        date: new Date().toLocaleString(),
        cashierName: profile?.full_name || 'Staff',
        branchName: branch.name,
        items: cart.map(c => ({
          name: c.name, quantity: c.quantity, unitPrice: c.price,
          totalPrice: (c.price + c.addons.reduce((a, ad) => a + ad.price * ad.quantity, 0)) * c.quantity,
          addons: c.addons,
        })),
        subtotal: cartSubtotal,
        discountAmount,
        discountType: discountValue ? discountType : null,
        vatAmount,
        serviceCharge,
        total: cartTotal,
        paymentMethod: pMethod,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        offline: true,
      });

      toast.success(`Order saved offline (${localId.slice(0, 8)}). Will sync automatically.`);
      setCheckoutOpen(false);
      setReceiptOpen(true);
      resetForm();
      return;
    }

    // Online flow (unchanged)
    try {
      const { data: orderNum } = await supabase.rpc('generate_order_number', { _branch_code: branch.code });
      const payload = buildOrderPayload('completed', 'paid');
      payload.order.order_number = orderNum || `ORD-${Date.now()}`;
      const order = await createOrder.mutateAsync(payload);
      await saveCustomerIfNeeded();

      const payments = isSplit
        ? splitPayments.filter(p => Number(p.amount) > 0).map(p => ({
            order_id: order.id, method: p.method, amount: Number(p.amount),
            branch_id: activeBranchId!, staff_id: user.id, reference: null,
          }))
        : [{ order_id: order.id, method: paymentMethod, amount: cartTotal,
             branch_id: activeBranchId!, staff_id: user.id, reference: payRef || null }];

      await createPayment.mutateAsync(payments);

      // Build receipt
      setReceiptData({
        orderNumber: order.order_number,
        orderType,
        date: new Date().toLocaleString(),
        cashierName: profile?.full_name || 'Staff',
        branchName: branch.name,
        items: cart.map(c => ({
          name: c.name, quantity: c.quantity, unitPrice: c.price,
          totalPrice: (c.price + c.addons.reduce((a, ad) => a + ad.price * ad.quantity, 0)) * c.quantity,
          addons: c.addons,
        })),
        subtotal: cartSubtotal,
        discountAmount,
        discountType: discountValue ? discountType : null,
        vatAmount,
        serviceCharge,
        total: cartTotal,
        paymentMethod: pMethod,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      });

      toast.success(`Order ${order.order_number} completed!`);
      setCheckoutOpen(false);
      setReceiptOpen(true);
      resetForm();
    } catch (e: any) {
      toast.error(e.message || 'Checkout failed');
    }
  };

  const resetForm = () => {
    setCart([]);
    setOrderNotes('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setPayRef('');
    setSplitPayments([]);
    setIsSplit(false);
    setDiscountValue('');
    setEnableVAT(false);
    setServiceChargePercent('');
  };

  const draftOrders = heldOrders?.filter(o => o.is_held) || [];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)] gap-0 -m-6">
      {/* LEFT: Menu */}
      <div className="flex-1 flex flex-col min-w-0 md:border-r border-border">
        {/* Order type + search */}
        <div className="p-3 border-b border-border flex gap-2 items-center flex-wrap">
          <div className="flex gap-1">
            {(['takeaway', 'delivery'] as OrderType[]).map(t => (
              <Button key={t} size="sm" variant={orderType === t ? 'default' : 'outline'}
                onClick={() => setOrderType(t)}>
                {t === 'takeaway' ? 'Takeaway' : 'Delivery'}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search menu..." className="pl-8 h-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {!isOnline && (
            <Badge variant="destructive" className="gap-1">
              <WifiOff className="h-3 w-3" /> Offline Mode
            </Badge>
          )}
          {syncing && (
            <Badge variant="outline" className="gap-1 border-warning text-warning">
              Syncing…
            </Badge>
          )}
        </div>

        {/* Offline banner */}
        {!isOnline && (
          <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/30 text-xs text-destructive-foreground">
            <span className="font-medium">You are offline.</span> Orders will sync automatically when connection is restored.
          </div>
        )}

        {/* Customer info */}
        <div className="px-3 py-2 border-b border-border flex gap-2 flex-wrap">
          <Input placeholder="Phone (optional)" className="h-9 w-[140px]" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
          <Input placeholder="Customer name (optional)" className="h-9 flex-1 min-w-[120px]" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          {orderType === 'delivery' && (
            <Input placeholder="Delivery address" className="h-9 flex-1 min-w-[150px]" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
          <Button size="sm" variant={!selectedCategory ? 'default' : 'ghost'} onClick={() => setSelectedCategory(null)}>All</Button>
          {effectiveCategories?.filter((c: any) => c.is_active).map((cat: any) => (
            <Button key={cat.id} size="sm" variant={selectedCategory === cat.id ? 'default' : 'ghost'}
              onClick={() => setSelectedCategory(cat.id)} className="whitespace-nowrap">
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Menu grid */}
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
            {filteredItems.map(item => (
              <button key={item.id} onClick={() => addToCart({ id: item.id, name: item.name, price: Number(item.price) })}
                className="bg-secondary hover:bg-secondary/80 active:scale-[0.98] rounded-lg p-3 text-left transition-all border border-border min-h-[110px]">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-20 object-cover rounded mb-2" />
                )}
                <p className="font-medium text-sm truncate text-foreground">{item.name}</p>
                <p className="text-primary font-bold text-sm mt-1">₦{Number(item.price).toLocaleString()}</p>
              </button>
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <UtensilsCrossed className="mx-auto h-10 w-10 mb-2 opacity-50" />
                <p>No items found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT: Cart */}
      <div className="w-full md:w-[340px] flex flex-col bg-card shrink-0 border-t md:border-t-0 border-border">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold text-sm">Cart ({cart.length})</h2>
          </div>
          <div className="flex gap-1">
            {(incomingOrders?.length || 0) > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-warning relative" onClick={() => setIncomingDialogOpen(true)}>
                <Bell className="h-3 w-3 mr-1" /> Incoming ({incomingOrders!.length})
              </Button>
            )}
            {draftOrders.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-primary" onClick={() => setResumeDialogOpen(true)}>
                <Play className="h-3 w-3 mr-1" /> Resume ({draftOrders.length})
              </Button>
            )}
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCart([])} className="text-destructive h-7 px-2">
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[40vh] md:max-h-none">
          <div className="p-2 space-y-1">
            {cart.map((item, idx) => (
              <div key={idx} className="bg-secondary rounded-md p-2">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-primary">₦{item.price.toLocaleString()} each</p>
                    {item.addons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.addons.map(a => (
                          <Badge key={a.id} variant="outline" className="text-xs">+{a.name}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(idx, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="text-sm w-6 text-center font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(idx, 1)}><Plus className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(idx)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <Button variant="link" size="sm" className="h-5 px-0 text-xs text-muted-foreground"
                    onClick={() => setAddonDialogItem(item)}>
                    + Add-ons
                  </Button>
                  <span className="text-sm font-bold text-primary">
                    ₦{((item.price + item.addons.reduce((a, ad) => a + ad.price * ad.quantity, 0)) * item.quantity).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">Cart is empty</p>
            )}
          </div>
        </ScrollArea>

        {/* Order notes */}
        <div className="px-2 pb-2">
          <Textarea placeholder="Order notes..." className="h-16 text-xs resize-none" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} />
        </div>

        <Separator />

        {/* Discount / VAT controls */}
        <div className="px-3 py-2 space-y-1.5 text-xs">
          {canDiscount ? (
            <div className="flex items-center gap-1">
              <Percent className="h-3 w-3 text-muted-foreground" />
              <Select value={discountType} onValueChange={v => setDiscountType(v as any)}>
                <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">₦ Fixed</SelectItem>
                  <SelectItem value="percentage">% Off</SelectItem>
                </SelectContent>
              </Select>
              <Input className="h-7 text-xs" placeholder="0" value={discountValue} onChange={e => setDiscountValue(e.target.value)} />
            </div>
          ) : (
            <div className="text-muted-foreground italic text-[11px]">Discounts disabled for your role</div>
          )}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={enableVAT} onChange={e => setEnableVAT(e.target.checked)} className="rounded" />
              <span>VAT 7.5%</span>
            </label>
            <Input className="h-7 text-xs w-20" placeholder="Svc %" value={serviceChargePercent} onChange={e => setServiceChargePercent(e.target.value)} />
            <span className="text-muted-foreground">Svc Charge</span>
          </div>
        </div>

        <Separator />

        {/* Total + Actions */}
        <div className="p-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span><span>₦{cartSubtotal.toLocaleString()}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-xs text-success">
              <span>Discount</span><span>-₦{discountAmount.toLocaleString()}</span>
            </div>
          )}
          {vatAmount > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>VAT (7.5%)</span><span>₦{vatAmount.toLocaleString()}</span>
            </div>
          )}
          {serviceCharge > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Service Charge</span><span>₦{serviceCharge.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1">
            <span className="font-display font-semibold">Total</span>
            <span className="text-xl font-bold font-display text-primary">₦{cartTotal.toLocaleString()}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={!cart.length} onClick={handleHoldOrder}>
              <Pause className="h-3.5 w-3.5 mr-1" /> Hold
            </Button>
            <Button className="flex-1 h-10" disabled={!cart.length || createOrder.isPending} onClick={() => setCheckoutOpen(true)}>
              <CreditCard className="h-4 w-4 mr-1" /> {isOnline ? 'Pay' : 'Pay (Offline)'} ₦{cartTotal.toLocaleString()}
            </Button>
          </div>
        </div>
      </div>

      {/* Addon Dialog */}
      <Dialog open={!!addonDialogItem} onOpenChange={() => setAddonDialogItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add-ons for {addonDialogItem?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
            {effectiveAddons?.filter((a: any) => a.is_available).map((addon: any) => {
              const selected = addonDialogItem?.addons.some(a => a.id === addon.id);
              return (
                <button key={addon.id} onClick={() => toggleAddon({ id: addon.id, name: addon.name, price: Number(addon.price) })}
                  className={`p-3 rounded-lg border text-left transition-colors ${selected ? 'border-primary bg-primary/10' : 'border-border bg-secondary hover:bg-secondary/80'}`}>
                  <p className="text-sm font-medium">{addon.name}</p>
                  <p className="text-xs text-primary">+₦{Number(addon.price).toLocaleString()}</p>
                </button>
              );
            })}
          </div>
          <Button onClick={() => setAddonDialogItem(null)}>Done</Button>
        </DialogContent>
      </Dialog>

      {/* Resume Draft Dialog */}
      <Dialog open={resumeDialogOpen} onOpenChange={setResumeDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Held Orders</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {draftOrders.map(order => (
                <button key={order.id} onClick={() => handleResumeOrder(order)}
                  className="w-full text-left p-3 rounded-lg border border-border bg-secondary hover:bg-secondary/80 transition-colors">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm">{order.order_number}</p>
                    <Badge variant="outline" className="text-xs">{order.order_type.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(order as any).order_items?.length || 0} items · ₦{Number(order.total).toLocaleString()}
                  </p>
                  {order.customer_name && <p className="text-xs text-muted-foreground">{order.customer_name}</p>}
                </button>
              ))}
              {draftOrders.length === 0 && <p className="text-center text-muted-foreground py-4">No held orders</p>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Incoming Orders Dialog */}
      <Dialog open={incomingDialogOpen} onOpenChange={setIncomingDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-warning" />
              Incoming Orders — Awaiting Approval
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {(incomingOrders || []).map((order: any) => (
                <Card key={order.id} className="bg-secondary border-border">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{order.order_number}</p>
                          <Badge variant="outline" className="text-xs">
                            {order.source === 'shop' ? '🛒 Shop' : 'POS'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{order.order_type.replace('_', ' ')}</Badge>
                        </div>
                        {order.customer_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {order.customer_name} {order.customer_phone && `· ${order.customer_phone}`}
                          </p>
                        )}
                      </div>
                      <p className="text-base font-bold text-primary">₦{Number(order.total).toLocaleString()}</p>
                    </div>
                    <div className="space-y-0.5 text-xs">
                      {order.order_items?.map((it: any) => (
                        <div key={it.id} className="flex justify-between text-muted-foreground">
                          <span>{it.quantity}× {it.item_name}</span>
                          <span>₦{Number(it.total_price).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1" onClick={() => approveIncoming(order)}>
                        <Check className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => rejectIncoming(order)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(incomingOrders?.length || 0) === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">No pending orders</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Checkout — ₦{cartTotal.toLocaleString()}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={!isSplit ? 'default' : 'outline'} size="sm" onClick={() => setIsSplit(false)}>Single Payment</Button>
              <Button variant={isSplit ? 'default' : 'outline'} size="sm" onClick={() => {
                setIsSplit(true);
                if (!splitPayments.length) setSplitPayments([{ method: 'cash', amount: '' }, { method: 'transfer', amount: '' }]);
              }}>Split Payment</Button>
            </div>

            {!isSplit ? (
              <div className="space-y-3">
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                    <SelectItem value="pos_machine">POS Machine</SelectItem>
                  </SelectContent>
                </Select>
                {paymentMethod !== 'cash' && (
                  <Input placeholder="Reference #" value={payRef} onChange={e => setPayRef(e.target.value)} />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {splitPayments.map((sp, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select value={sp.method} onValueChange={v => setSplitPayments(prev => prev.map((p, j) => j === i ? { ...p, method: v } : p))}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                        <SelectItem value="pos_machine">POS</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder="Amount" value={sp.amount}
                      onChange={e => setSplitPayments(prev => prev.map((p, j) => j === i ? { ...p, amount: e.target.value } : p))} />
                    {splitPayments.length > 2 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSplitPayments(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setSplitPayments(prev => [...prev, { method: 'cash', amount: '' }])}>
                  + Add Split
                </Button>
                <p className="text-xs text-muted-foreground">
                  Split total: ₦{splitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0).toLocaleString()} of ₦{cartTotal.toLocaleString()}
                </p>
              </div>
            )}

            <Button className="w-full h-11" disabled={createOrder.isPending || createPayment.isPending} onClick={handleCheckout}>
              Complete Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} receipt={receiptData} />
    </div>
  );
}
