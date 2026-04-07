// frontend/src/components/super/ReasonConfirmModal.tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ReasonConfirmModal(props: {
  open: boolean;
  title: string;
  confirmText?: string;
  placeholder?: string;
  requireReason?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const {
    open,
    title,
    confirmText = "Confirm",
    placeholder = "Reason (required for audit)…",
    requireReason = true,
    onClose,
    onConfirm,
  } = props;

  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setBusy(false);
    }
  }, [open]);

  const canConfirm = !busy && (!requireReason || reason.trim().length >= 3);

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Reason</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          {requireReason && (
            <div className="text-xs text-gray-500">Minimum 3 characters.</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="bg-brand-blue text-white"
            disabled={!canConfirm}
            onClick={async () => {
              try {
                setBusy(true);
                await onConfirm(reason.trim());
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}