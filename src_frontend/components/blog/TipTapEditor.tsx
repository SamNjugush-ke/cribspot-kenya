'use client';

import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';

// ✅ Import custom extensions
import Gallery from './tiptap/extensions/Gallery';
import CtaButton from './tiptap/extensions/CtaButton';

export default function TipTapEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (html: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: true, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Gallery,
      CtaButton,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    autofocus: false,
    editable: true,
    immediatelyRender: false,
    // ✅ removed `immediatelyRender` (not valid in TipTap v2 types)
  });

  // Keep editor in sync when parent swaps content
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(content || '', { emitUpdate: false });
  }, [content, editor]);

  if (!mounted || !editor) return <div className="min-h-[300px] border rounded" />;

  return (
    <div className="border rounded-md">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 p-2 border-b bg-gray-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const url = window.prompt('Image URL');
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
        >
          + Image
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const raw = window.prompt('Comma-separated image URLs for gallery');
            if (!raw) return;
            const urls = raw.split(',').map((s) => s.trim()).filter(Boolean);
            if (urls.length) (editor.commands as any).setGallery(urls);
          }}
        >
          + Gallery
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const label = window.prompt('Button label', 'Read more') || 'Read more';
            const href = window.prompt('Button link', '#') || '#';
            (editor.commands as any).setCtaButton(label, href);
          }}
        >
          + Button
        </Button>
      </div>

      <EditorContent
        editor={editor}
        className="prose max-w-none p-4 min-h-[400px]"
      />
    </div>
  );
}
