//frontend/src/app/dashboard/editor/tags/page.tsx code:
'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete, apiPatch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, Trash2, Plus } from 'lucide-react';

type Tag = { id: string; name: string; slug: string };

export default function TagsPage() {
  const [items, setItems] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await apiGet<Tag[] | null>('/api/blogs/tags/all');
    setItems(res.json || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!newName.trim()) return toast.error('Enter a tag name');
    setBusyId('new');
    const res = await apiPost<any>('/api/blogs/tags', { name: newName.trim() });
    setBusyId(null);

    if (res.ok && res.json?.id) {
      toast.success('Tag created');
      setNewName('');
      await load();
    } else {
      toast.error(res.json?.message || 'Failed to create tag');
    }
  }

  async function save(id: string) {
    const name = (editing[id] || '').trim();
    if (!name) return toast.error('Name required');
    setBusyId(id);
    const res = await apiPatch<any>(`/api/blogs/tags/${id}`, { name });
    setBusyId(null);

    if (res.ok && res.json?.id) {
      toast.success('Saved');
      setEditing((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      await load();
    } else {
      toast.error(res.json?.message || 'Failed to update');
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this tag?')) return;
    setBusyId(id);
    const res = await apiDelete<any>(`/api/blogs/tags/${id}`);
    setBusyId(null);

    if (res.ok) {
      toast.success('Deleted');
      await load();
    } else {
      toast.error(res.json?.message || 'Failed to delete');
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tags</h1>
        <p className="text-sm text-gray-600">Manage blog tags used for posts.</p>
      </div>

      <div className="rounded-xl border bg-white p-4 flex gap-2">
        <Input placeholder="New tag name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button onClick={add} disabled={busyId === 'new'}>
          <Plus className="h-4 w-4 mr-2" /> Add
        </Button>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        {loading ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No tags yet.</div>
        ) : (
          <div className="divide-y">
            {items.map((t) => {
              const isEditing = typeof editing[t.id] === 'string';
              const value = isEditing ? editing[t.id] : t.name;

              return (
                <div key={t.id} className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Input
                      value={value}
                      onChange={(e) => setEditing((p) => ({ ...p, [t.id]: e.target.value }))}
                    />
                    <div className="mt-1 text-xs text-gray-500">Slug: {t.slug}</div>
                  </div>

                  <Button variant="outline" onClick={() => save(t.id)} disabled={busyId === t.id}>
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>

                  <Button variant="destructive" onClick={() => remove(t.id)} disabled={busyId === t.id}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
