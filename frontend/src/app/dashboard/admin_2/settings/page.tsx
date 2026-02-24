'use client';

import { useEffect, useState } from 'react';
import Guard from '@/components/auth/Guard';
import RequirePermission from '@/components/super/RequirePermission';
import { apiFetch } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

type SettingRow = {
  id: string;
  brandName: string;
  supportEmail: string;
  config: any;
  updatedAt?: string;
};

export default function AdminSettingsPage() {
  return (
    <Guard allowed={['ADMIN', 'SUPER_ADMIN']}>
      <RequirePermission anyOf={['MANAGE_SETTINGS', 'CHANGE_PLATFORM_SETTINGS']}>
        <SettingsInner />
      </RequirePermission>
    </Guard>
  );
}

function SettingsInner() {
  const [items, setItems] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [brandName, setBrandName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [configText, setConfigText] = useState('{
  
}');

  const active = items[0] || null;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const json = await apiFetch<any>('/admin/settings');
      const arr: SettingRow[] = Array.isArray(json) ? json : json?.items || json?.settings || [];
      setItems(arr);

      const first = arr[0];
      if (first) {
        setBrandName(first.brandName || '');
        setSupportEmail(first.supportEmail || '');
        setConfigText(JSON.stringify(first.config ?? {}, null, 2));
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to load settings');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!active?.id) return;

    let config: any = {};
    try {
      config = configText.trim() ? JSON.parse(configText) : {};
    } catch {
      toast.error('Config must be valid JSON');
      return;
    }

    try {
      setSavingId(active.id);
      await apiFetch(`/admin/settings/${active.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          brandName: brandName.trim(),
          supportEmail: supportEmail.trim(),
          config,
        }),
      });
      toast.success('Settings saved');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save settings');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <div className="text-sm text-muted-foreground">
            {loading
              ? 'Loading…'
              : active
              ? `Last updated: ${active.updatedAt ? new Date(active.updatedAt).toLocaleString() : '—'}`
              : 'No settings row found.'}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading || !!savingId}>
            Refresh
          </Button>
          <Button className="bg-brand-blue text-white" onClick={save} disabled={!active || !!savingId}>
            {savingId ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Brand name</Label>
              <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="CribSpot Kenya" />
            </div>
            <div className="space-y-1">
              <Label>Support email</Label>
              <Input
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@cribspot.co.ke"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Config (JSON)</Label>
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              rows={14}
              className="w-full rounded-md border px-3 py-2 font-mono text-xs"
            />
            <div className="text-xs text-muted-foreground">
              Store any extra settings here. Keep it valid JSON or it will refuse to save (because chaos).
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
