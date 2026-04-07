'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiDelete, apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type MediaItem = {
  url: string;
  path?: string;
  filename?: string;
  size?: number;
  mime?: string;
  createdAt?: string;
};

export default function EditorMediaLibraryPage() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);

  const load = async () => {
    setLoading(true);
    const res = await apiGet<{ files: MediaItem[] }>('/api/uploads', { params: { dir: 'blog', q } } as any);
    if (res.ok && res.json?.files) {
      setItems(res.json.files);
    } else {
      setItems([]);
      toast.error('Failed to load media');
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const del = async (path?: string) => {
    if (!path) return;
    if (!confirm('Delete this file?')) return;
    const res = await apiDelete(`/api/uploads?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      toast.success('Deleted');
      await load();
    } else {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold">Media Library</h1>
          <p className="text-sm text-gray-600">Blog images stored in backend/uploads/blogs</p>
        </div>

        <Link href="/dashboard/editor/media/new">
          <Button className="bg-[#004AAD] hover:bg-[#00398a]">+ Add New Media File</Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search filename..."
          className="max-w-sm"
        />
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {loading && <div className="col-span-full text-sm text-gray-500">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="col-span-full text-sm text-gray-500">No media found.</div>
        )}

        {items.map((it) => (
          <div key={it.url} className="border rounded-lg overflow-hidden bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt={it.filename || 'image'} className="w-full h-36 object-cover" />
            <div className="p-2 text-xs">
              <div className="truncate">{it.filename || it.url.split('/').pop()}</div>
              {it.size ? <div className="text-gray-500">{Math.round(it.size / 1024)} KB</div> : null}
            </div>
            <div className="p-2 flex gap-2">
              <Button size="sm" variant="outline" className="h-7" onClick={() => navigator.clipboard.writeText(it.url)}>
                Copy URL
              </Button>
              <Button size="sm" variant="destructive" className="h-7" onClick={() => del(it.path)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
