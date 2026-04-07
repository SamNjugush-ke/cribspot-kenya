"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, apiDelete } from "@/lib/api";
import { Button } from "@/components/ui/button";

export type ImageItem = { id?: string; url: string };

type Props = {
  propertyId: string;

  /** Use ImageItem[] so removals can delete from server (needs id). */
  images: ImageItem[];

  /** Parent receives ImageItem[] (ids preserved). */
  onChange: (items: ImageItem[]) => void;

  /** default 10 */
  maxImages?: number;

  /** optional: parent can disable submit while uploading */
  onBusyChange?: (busy: boolean) => void;
};

function uniqByUrl(items: ImageItem[]) {
  const seen = new Set<string>();
  const out: ImageItem[] = [];
  for (const it of items) {
    if (!it?.url) continue;
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    out.push(it);
  }
  return out;
}

export default function ImageUploader({
  propertyId,
  images,
  onChange,
  maxImages: maxImagesProp = 10,
  onBusyChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const maxImages = useMemo(() => Math.max(1, maxImagesProp), [maxImagesProp]);

  const [items, setItems] = useState<ImageItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const syncAndTrim = (next: ImageItem[]) => {
    const cleaned = uniqByUrl(next).filter((x) => x.url).slice(0, maxImages);
    setItems(cleaned);
    onChange(cleaned);
  };

  // Keep internal list in sync when parent loads an existing draft
  useEffect(() => {
    syncAndTrim(images || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(images), maxImages]);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  async function handlePickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = maxImages - items.length;
    if (remaining <= 0) {
      setErr(`Maximum of ${maxImages} images reached.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const picked = files.slice(0, remaining);
    if (picked.length < files.length) {
      setErr(`You can only upload up to ${maxImages} images. Only the first ${picked.length} will be added.`);
    }

    setBusy(true);
    try {
      const uploaded: ImageItem[] = [];
      const uploadUrl = `${API_BASE}/properties/${propertyId}/images`;

      for (const f of picked) {
        const fd = new FormData();
        fd.append("file", f);

        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            ...(typeof window !== "undefined" && localStorage.getItem("rk_token")
              ? { Authorization: `Bearer ${localStorage.getItem("rk_token")}` }
              : {}),
          },
          body: fd,
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.message || `Upload failed (HTTP ${res.status})`);
        }

        const j = (await res.json()) as { id?: string; url: string };
        uploaded.push({ id: j.id, url: j.url });
      }

      // Final trim + dedupe guarantees no broken placeholders downstream
      syncAndTrim([...items, ...uploaded]);
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeImage(img: ImageItem) {
    setErr(null);

    // optimistic UI
    const optimistic = items.filter((x) => x.url !== img.url);
    setItems(optimistic);
    onChange(optimistic);

    // If it exists on server, delete there too
    if (img.id) {
      try {
        const res = await apiDelete(`/properties/${propertyId}/images/${img.id}`);
        if (!res.ok) throw new Error((res.data as any)?.message || `Delete failed (HTTP ${res.status})`);
      } catch (e: any) {
        // rollback if server delete failed
        const rolledBack = uniqByUrl([...optimistic, img]).slice(0, maxImages);
        setItems(rolledBack);
        onChange(rolledBack);
        setErr(e?.message || "Failed to delete image");
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
          className="hidden"
        />
        <Button
          className="bg-brand-blue text-white hover:bg-black"
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Uploading…" : "Add Images"}
        </Button>
        <div className="text-xs text-gray-600">
          {items.length}/{maxImages}
        </div>
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

      <p className="text-xs text-gray-600 mt-2">Up to {maxImages} images. First image is used as the cover.</p>
    </div>
  );
}