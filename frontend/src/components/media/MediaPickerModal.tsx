'use client';

import { useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Check, Trash2, Upload } from 'lucide-react';

type MediaItem = {
  url: string;
  path?: string;
  filename?: string;
  size?: number;
  mime?: string;
  createdAt?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (url: string) => void;

  listEndpoint?: string;      // default: '/api/uploads'
  uploadEndpoint?: string;    // default: '/api/uploads'
  deleteEndpoint?: string;    // default: '/api/uploads'
  dir?: 'blog' | 'misc' | 'properties' | string;

  // ✅ if true, uploading a file auto-selects it (perfect for cover image UX)
  autoSelectOnUpload?: boolean;
};

export default function MediaPickerModal({
  open,
  onOpenChange,
  onSelect,
  listEndpoint = '/api/uploads',
  uploadEndpoint = '/api/uploads',
  deleteEndpoint = '/api/uploads',
  dir = 'blog',
  autoSelectOnUpload = false,
}: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    const res = await apiGet<{ files: MediaItem[] }>(listEndpoint, { params: { dir, q } } as any);
    if (res.ok && res.data?.files) {
      setItems(res.data.files);
    } else {
      setItems([]);
      if (!res.ok) toast.error('Failed to load media');
    }
    setLoading(false);
  }

  useEffect(() => {
    if (open) {
      setSelected(null);
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q, dir]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);

    setUploading(true);
    const res = await apiPost<any>(`${uploadEndpoint}?dir=${encodeURIComponent(dir)}`, fd);
    setUploading(false);

    const url = res?.json?.url || res?.data?.url;
    if (res.ok && url) {
      toast.success('Uploaded');
      setQ('');
      await load();

      if (autoSelectOnUpload) {
        onSelect(url);
        onOpenChange(false);
      } else {
        // keep modal open: select the uploaded item visually if it exists
        setSelected({ url });
      }
    } else {
      toast.error('Upload failed');
    }

    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleDelete(path?: string) {
    if (!path) return;
    if (!confirm('Delete this image?')) return;
    const res = await apiDelete(`${deleteEndpoint}?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      toast.success('Deleted');
      if (selected?.path === path) setSelected(null);
      await load();
    } else {
      toast.error('Delete failed');
    }
  }

  const canSelect = !!selected?.url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Media Library</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Input
            placeholder="Search by filename…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />

          <div className="ml-auto flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading…' : 'Choose file'}
            </Button>

            <Button
              size="sm"
              disabled={!canSelect}
              className="bg-[#004AAD] hover:bg-[#00398a]"
              onClick={() => {
                if (!selected) return;
                onSelect(selected.url);
                onOpenChange(false);
              }}
            >
              <Check className="h-4 w-4 mr-2" /> Select
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[420px] overflow-auto">
          {loading && <div className="col-span-full text-sm text-gray-500">Loading…</div>}
          {!loading && items.length === 0 && <div className="col-span-full text-sm text-gray-500">No media found.</div>}

          {items.map((it) => {
            const isSel = selected?.url === it.url;
            return (
              <div
                key={it.url}
                className={[
                  'group border rounded-lg overflow-hidden bg-white shadow-sm cursor-pointer',
                  isSel ? 'ring-2 ring-[#004AAD]' : 'hover:ring-2 hover:ring-gray-200',
                ].join(' ')}
                onClick={() => setSelected(it)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={it.filename || 'image'} className="w-full h-36 object-cover" />
                <div className="p-2 text-xs">
                  <div className="truncate">{it.filename || it.url.split('/').pop()}</div>
                  {it.size ? <div className="text-gray-500">{Math.round(it.size / 1024)} KB</div> : null}
                </div>

                <div className="p-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(it);
                      onSelect(it.url);
                      onOpenChange(false);
                    }}
                  >
                    Use
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(it.path);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
