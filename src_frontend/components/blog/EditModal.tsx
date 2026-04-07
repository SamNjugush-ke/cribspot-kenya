'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  blogId?: string;
  open: boolean;
  onClose: () => void;
};

export default function EditModal({ blogId, open, onClose }: Props) {
  if (!blogId) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open with which editor?</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Link href={`/dashboard/editor/blog-editor?id=${blogId}&editor=TIPTAP`}>
            <Button>TipTap</Button>
          </Link>
          <Link href={`/dashboard/editor/blog-editor?id=${blogId}&editor=EDITORJS`}>
            <Button variant="outline">Editor.js</Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
