'use client';

import { useRef, useState } from 'react';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function EditorMediaNewPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);

    setUploading(true);
    const res = await apiPost<{ url: string }>('/api/uploads?dir=blog', fd);
    setUploading(false);

    if (res.ok) {
      toast.success('Uploaded');
      router.push('/dashboard/editor/media');
    } else {
      toast.error('Upload failed');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-xl">
      <h1 className="text-2xl font-semibold mb-1">Add New Media File</h1>
      <p className="text-sm text-gray-600 mb-6">Upload an image to the Blog media library.</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />

      <Button
        className="bg-[#004AAD] hover:bg-[#00398a]"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? 'Uploading…' : 'Choose file to upload'}
      </Button>

      <div className="mt-4">
        <Button variant="outline" onClick={() => router.push('/dashboard/editor/media')}>
          Back to library
        </Button>
      </div>
    </div>
  );
}
