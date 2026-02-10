//frontend/src/components/billing/CheckoutDialog.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';

/* -------------------- types -------------------- */

export type Plan = {
  id: string;
  name: string;
  price: number;
  durationInDays: number;
  totalListings: number;
  featuredListings: number;
  isActive: boolean;
};

type Payment = {
  id: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  amount: number;
  externalRef?: string | null;
  transactionCode?: string | null;
  createdAt: string;
  plan?: Plan;
};

type Subscription = {
  id: string;
  isActive: boolean;
  startedAt: string;
  expiresAt: string;
  remainingListings: number;
  remainingFeatured: number;
  plan?: Plan;
};

type InitRes = {
  message: string;
  paymentId: string;
  providerRef?: string | null;
  providerMsg?: string | null;
};

/* -------------------- helpers -------------------- */

function normalizePhone(countryCode: string, local: string) {
  const digits = local.replace(/[^\d]/g, '');
  if (!/^[17]\d{8}$/.test(digits)) return null;
  return `${countryCode}${digits}`;
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleString();
}

/* -------------------- component -------------------- */

export default function CheckoutDialog({
  open,
  onOpenChange,
  plan,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: Plan | null;
  onSuccess?: () => void;
}) {
  const COUNTRY_CODE = '254';

  const [localPhone, setLocalPhone] = useState('7');
  const [stage, setStage] =
    useState<'idle' | 'initiated' | 'polling' | 'success' | 'failed'>('idle');

  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [providerMsg, setProviderMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [latestPayment, setLatestPayment] = useState<Payment | null>(null);
  const [latestSub, setLatestSub] = useState<Subscription | null>(null);

  const title = plan ? `Pay with M-Pesa — ${plan.name}` : 'Pay with M-Pesa';
  const amount = plan?.price ?? 0;

  /* reset on close */
  useEffect(() => {
    if (!open) {
      setStage('idle');
      setPaymentId(null);
      setProviderMsg(null);
      setErr(null);
      setLatestPayment(null);
      setLatestSub(null);
      setLocalPhone('7');
    }
  }, [open]);

  /* -------------------- STK init -------------------- */

  async function startStk() {
    setErr(null);
    setProviderMsg(null);
    setLatestPayment(null);
    setLatestSub(null);

    if (!plan) {
      setErr('Please choose a plan first.');
      return;
    }

    const fullPhone = normalizePhone(COUNTRY_CODE, localPhone);
    if (!fullPhone) {
      setErr('Enter phone as 7XXXXXXXX.');
      return;
    }

    try {
      setStage('initiated');

      const res = await apiPost<InitRes>('/api/payments/mpesa/init', {
        planId: plan.id,
        phone: fullPhone,
      });

      if (!res.ok || !res.json) {
        setStage('failed');
        setErr(res.json?.message || `Failed to start payment`);
        return;
      }

      setPaymentId(res.json.paymentId);
      setProviderMsg(res.json.providerMsg || res.json.message);
      setStage('polling');
    } catch (e: any) {
      setStage('failed');
      setErr(e?.message || 'Failed to start payment');
    }
  }

  /* -------------------- Complete payment -------------------- */

  async function completePayment() {
    if (!paymentId || !plan) return;

    setErr(null);
    setStage('polling');

    try {
      for (let i = 0; i < 10; i++) {
        const mine = await apiGet<Payment[]>('/api/payments/mine');
        const list = mine.json || [];

        const match = list.find(
          (p) =>
            p.id === paymentId &&
            p.plan?.id === plan.id
        );

        if (match) {
          setLatestPayment(match);

          if (match.status === 'SUCCESS' && match.transactionCode) {
            const subRes = await apiGet<Subscription>('/api/subscriptions/me');
            if (subRes.ok && subRes.json) setLatestSub(subRes.json);

            setStage('success');
            onSuccess?.();
            return;
          }

          if (match.status === 'FAILED' || match.status === 'EXPIRED') {
            setStage('failed');
            setErr(
              `Payment ${match.status}. ${
                match.transactionCode ? `Receipt: ${match.transactionCode}` : ''
              }`.trim()
            );
            return;
          }
        }

        await new Promise((r) => setTimeout(r, 1500));
      }

      setProviderMsg(
        'Still pending. If you approved on your phone, click “Complete payment” again shortly.'
      );
    } catch (e: any) {
      setStage('failed');
      setErr(e?.message || 'Failed to confirm payment');
    }
  }

  const badge = (() => {
    if (stage === 'success') return <Badge className="bg-green-100 text-green-700">SUCCESS</Badge>;
    if (stage === 'failed') return <Badge className="bg-red-100 text-red-700">FAILED</Badge>;
    if (stage === 'polling' || stage === 'initiated')
      return <Badge className="bg-yellow-100 text-yellow-800">PENDING</Badge>;
    return <Badge className="bg-gray-100 text-gray-700">READY</Badge>;
  })();

  /* -------------------- UI -------------------- */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="truncate">{title}</span>
            {badge}
          </DialogTitle>
          <DialogDescription>
            Approve the M-Pesa prompt, then click <b>Complete payment</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4">
            <div className="flex justify-between gap-3">
              <div>
                <div className="text-sm text-gray-600">Plan</div>
                <div className="font-semibold">{plan?.name ?? '—'}</div>
                <div className="mt-1 text-xs text-gray-600">
                  {plan?.durationInDays} days • {plan?.totalListings} listings • {plan?.featuredListings} featured
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Amount</div>
                <div className="text-2xl font-bold text-[#004AAD]">KES {amount}</div>
              </div>
            </div>

            <Separator className="my-3" />

            <Label>M-Pesa phone</Label>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 w-full">
                <span className="px-3 py-2 border rounded-md bg-gray-50 text-gray-700">254</span>
                <div className="relative flex-1">
                  <Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    value={localPhone}
                    onChange={(e) => setLocalPhone(e.target.value)}
                    className="pl-9"
                    placeholder="7XXXXXXXX"
                  />
                </div>
              </div>

              <Button
                className="bg-[#004AAD] hover:bg-[#00398a]"
                onClick={startStk}
                disabled={stage === 'initiated' || stage === 'polling'}
              >
                {stage === 'initiated' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send STK'}
              </Button>
            </div>
          </div>

          {providerMsg && (
            <div className="rounded-xl border bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {providerMsg}
              {paymentId && (
                <div className="mt-1 text-xs">Payment ID: {paymentId}</div>
              )}
            </div>
          )}

          {err && (
            <div className="rounded-xl border bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5" />
              <div>{err}</div>
            </div>
          )}

          {stage === 'success' && latestSub && (
            <div className="rounded-xl border bg-green-50 px-4 py-3 text-sm text-green-800">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Subscription active
              </div>
              <div className="mt-1 text-xs">
                Expires: <b>{fmtDate(latestSub.expiresAt)}</b>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {stage === 'success' ? 'Close' : 'Cancel'}
          </Button>

          <Button
            onClick={completePayment}
            disabled={!paymentId || stage === 'idle' || stage === 'initiated'}
            className="bg-[#004AAD] hover:bg-[#00398a]"
          >
            {stage === 'polling' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Complete payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
