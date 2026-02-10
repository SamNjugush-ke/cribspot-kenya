//frontend/src/components/listing/ImageUploader.tsx code:
'use client';

import { useRef, useState } from 'react';
import api, { apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';

type ImageItem = { id?: string; url: string };

type Props = {
  propertyId: string;
  images: Array<string | ImageItem>;
  onChange: (urls: string[]) => void;
};

function normalize(images: Array<string | ImageItem>): ImageItem[] {
  return images.map((i) => (typeof i === 'string' ? { url: i } : i));
}

export default function ImageUploader({ propertyId, images, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<ImageItem[]>(normalize(images));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const notifyParent = (list: ImageItem[]) => onChange(list.map((x) => x.url));

  async function handlePickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setBusy(true);
    try {
      const uploaded: ImageItem[] = [];

      // upload sequentially (simple + safe)
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        // POST /api/properties/:id/images
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'}/api/properties/${propertyId}/images`,
          {
            method: 'POST',
            headers: {
              // auth header handled in api.ts normally, but here we send multipart so we fetch directly
              ...(typeof window !== 'undefined' && localStorage.getItem('rk_token')
                ? { Authorization: `Bearer ${localStorage.getItem('rk_token')}` }
                : {}),
            },
            body: fd,
          }
        );

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.message || `Upload failed (HTTP ${res.status})`);
        }

        const j = (await res.json()) as { id?: string; url: string };
        uploaded.push({ id: j.id, url: j.url });
      }

      const next = [...items, ...uploaded];
      setItems(next);
      notifyParent(next);
    } catch (e: any) {
      setErr(e?.message || 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removeImage(img: ImageItem) {
    setErr(null);
    const optimistic = items.filter((x) => x.url !== img.url);
    setItems(optimistic);
    notifyParent(optimistic);

    // If this image exists server-side (has id), delete there too
    if (img.id) {
      try {
        // DELETE /api/properties/:id/images/:imageId
        const res = await apiDelete(`/api/properties/${propertyId}/images/${img.id}`);
        if (!res.ok) throw new Error((res.json as any)?.message || `Delete failed (HTTP ${res.status})`);
      } catch (e: any) {
        // rollback if server delete failed
        const rolledBack = [...optimistic, img];
        setItems(rolledBack);
        notifyParent(rolledBack);
        setErr(e?.message || 'Failed to delete image');
      }
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePickFiles}
          disabled={busy}
          className='hidden'
        />
        <Button className="bg-brand-blue text-white hover:bg-black" type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : 'Add Images'}
        </Button>
      </div>

      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((img) => (
          <figure key={img.url} className="relative group border rounded-lg overflow-hidden bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="Property" className="w-full h-32 object-cover" />
            <button
              type="button"
              onClick={() => removeImage(img)}
              className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-red-600 text-white opacity-90 hover:opacity-100"
            >
              Remove
            </button>
          </figure>
        ))}
      </div>
      <p className="text-xs text-gray-600 mt-2">Up to 10 images. First image is used as the cover.</p>
    </div>
  );
}