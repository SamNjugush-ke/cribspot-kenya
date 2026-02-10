'use client';

import { useState, useEffect } from 'react';
import Guard from '@/components/auth/Guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { API_BASE } from '@/lib/api';

type Settings = { brandName: string; supportEmail: string };

export default function SettingsPage() {
  return (
    <Guard allowed={['SUPER_ADMIN']}>
      <SettingsInner />
    </Guard>
  );
}

function SettingsInner() {
  const [settings, setSettings] = useState<Settings>({ brandName: '', supportEmail: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const token = localStorage.getItem('rk_token');
    const res = await fetch(`${API_BASE}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setSettings(await res.json());
  }

  async function save() {
    setSaving(true);
    const token = localStorage.getItem('rk_token');
    await fetch(`${API_BASE}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(settings),
    });
    setSaving(false);
  }

  return (
    <section className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Brand Name</label>
          <Input
            value={settings.brandName}
            onChange={(e) => setSettings((s) => ({ ...s, brandName: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Support Email</label>
          <Input
            type="email"
            value={settings.supportEmail}
            onChange={(e) => setSettings((s) => ({ ...s, supportEmail: e.target.value }))}
          />
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </section>
  );
}
