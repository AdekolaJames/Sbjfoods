import { useEffect, useState } from 'react';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SystemResetSection } from '@/components/settings/SystemResetSection';
import { PermissionsSection } from '@/components/settings/PermissionsSection';

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<any>(null);

  useEffect(() => { if (settings) setForm({ ...settings }); }, [settings]);

  if (isLoading || !form) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>;

  const save = async () => {
    try {
      await update.mutateAsync(form);
      toast.success('Settings saved');
    } catch (e: any) { toast.error(e.message); }
  };

  const setField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure business, tax, payments and receipts</p>
      </div>

      <Tabs defaultValue="business">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
          <TabsTrigger value="payment">Payments</TabsTrigger>
          <TabsTrigger value="receipt">Receipt</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="reset">System Reset</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle>Business Details</CardTitle><CardDescription>Shown on receipts and customer-facing pages</CardDescription></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div><Label>Business Name</Label><Input value={form.business_name || ''} onChange={e => setField('business_name', e.target.value)} /></div>
              <div><Label>Logo URL</Label><Input value={form.logo_url || ''} onChange={e => setField('logo_url', e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address || ''} onChange={e => setField('address', e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={form.phone || ''} onChange={e => setField('phone', e.target.value)} /></div>
              <div><Label>Email</Label><Input value={form.email || ''} onChange={e => setField('email', e.target.value)} /></div>
              <div><Label>Currency</Label><Input value={form.currency || 'NGN'} onChange={e => setField('currency', e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle>Tax & Charges</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div><Label>VAT %</Label><Input type="number" step="0.01" value={form.vat_percent || 0} onChange={e => setField('vat_percent', Number(e.target.value))} /></div>
              <div><Label>Default Service Charge %</Label><Input type="number" step="0.01" value={form.service_charge_percent || 0} onChange={e => setField('service_charge_percent', Number(e.target.value))} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle>Payment Methods</CardTitle><CardDescription>Toggle which methods staff can collect</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between"><Label>Cash</Label><Switch checked={form.enable_cash} onCheckedChange={v => setField('enable_cash', v)} /></div>
              <div className="flex items-center justify-between"><Label>Bank Transfer</Label><Switch checked={form.enable_transfer} onCheckedChange={v => setField('enable_transfer', v)} /></div>
              <div className="flex items-center justify-between"><Label>POS Machine</Label><Switch checked={form.enable_pos} onCheckedChange={v => setField('enable_pos', v)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipt" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle>Receipt Customisation</CardTitle></CardHeader>
            <CardContent>
              <Label>Footer message</Label>
              <Input value={form.receipt_footer || ''} onChange={e => setField('receipt_footer', e.target.value)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <PermissionsSection />
        </TabsContent>

        <TabsContent value="reset" className="space-y-4">
          <SystemResetSection />
        </TabsContent>
      </Tabs>

      <Button onClick={save} disabled={update.isPending}>
        {update.isPending ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}
