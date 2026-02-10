'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BedDouble,
  Bath,
  Share2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  MapPin,
  ZoomIn,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ContactCard from '@/components/ContactCard';
import { API_BASE } from "@/lib/api";


type Unit = {
  id: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  available?: number | null;
  status?: string | null;
  type?: string | null;
};

type Img = { id: string; url: string };
type Lister = { id: string; name: string; phone?: string | null; createdAt?: string };

type Amenity = { id: string; amenity: { id: string; name: string } };

type Property = {
  id: string;
  title: string;
  location: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  images: Img[];
  units: Unit[];
  lister?: Lister | null;
  county?: string | null;
  constituency?: string | null;
  ward?: string | null;
  area?: string | null;
  amenities?: Amenity[];
};

/* -------- Helpers -------- */
function formatKES(n: number | undefined | null) {
  if (!n && n !== 0) return '';
  try {
    return n.toLocaleString('en-KE', { maximumFractionDigits: 0 });
  } catch {
    return String(n);
  }
}

/* -------- Image Slider -------- */
function ImageSlider({
  images,
  minRent,
  onShare,
}: {
  images: Img[];
  minRent: number | null;
  onShare: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  if (!images || images.length === 0) {
    return (
      <div className="relative w-full h-[400px] bg-gray-100 flex items-center justify-center rounded-xl">
        <img
          src="/placeholder.webp"
          alt="No image"
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  function prev() {
    setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  }
  function next() {
    setIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  }

  return (
    <div className="relative w-full space-y-3">
      {/* Main image */}
      <div className="relative w-full h-[450px] bg-gray-100 flex items-center justify-center rounded-xl overflow-hidden">
        <img
          src={images[index].url}
          alt={`Image ${index + 1}`}
          className="max-h-full max-w-full object-contain"
        />

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute top-1/2 left-4 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute top-1/2 right-4 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Zoom button */}
        <button
          onClick={() => setZoomOpen(true)}
          className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setIndex(i)}
              className={`h-16 w-20 flex-shrink-0 rounded border overflow-hidden ${
                i === index ? 'ring-2 ring-brand-blue' : ''
              }`}
            >
              <img
                src={img.url}
                alt={`Thumb ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Rent & share overlay (below thumbnails now) */}
      <div className="bg-black/50 text-white flex flex-col md:flex-row md:items-end justify-between p-4 gap-2 rounded-lg">
        {minRent !== null && (
          <div>
            <p className="text-2xl font-bold">KES {formatKES(minRent)}</p>
            <span className="text-xs">per month (from)</span>
          </div>
        )}
        <Button
          size="icon"
          variant="secondary"
          className="bg-white/90 text-brand-blue self-start md:self-auto"
          onClick={onShare}
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Zoom overlay */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-6xl p-0">
          <div className="relative bg-black flex items-center justify-center">
            <img
              src={images[index].url}
              alt={`Zoom ${index + 1}`}
              className="max-h-[90vh] max-w-full object-contain bg-black"
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute top-1/2 left-4 -translate-y-1/2 bg-black/70 text-white p-2 rounded-full"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={next}
                  className="absolute top-1/2 right-4 -translate-y-1/2 bg-black/70 text-white p-2 rounded-full"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
          {/* thumbs in zoom too */}
          {images.length > 1 && (
            <div className="flex gap-2 p-3 bg-black overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setIndex(i)}
                  className={`h-20 w-28 flex-shrink-0 rounded border overflow-hidden ${
                    i === index ? 'ring-2 ring-blue-400' : ''
                  }`}
                >
                  <img
                    src={img.url}
                    alt={`Zoom thumb ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------- Fetch helpers -------- */
async function fetchProperty(id: string): Promise<Property | null> {
  try {
    const res = await fetch(`${API_BASE}/api/properties/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function fetchSimilar(id: string): Promise<Property[]> {
  try {
    const res = await fetch(`${API_BASE}/api/properties/${id}/similar`, { cache: 'no-store' });
    if (!res.ok) return [];
    const d = await res.json();
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

/* -------- Page -------- */
export default function PropertyPage({ params }: { params: { id: string } }) {
  const [prop, setProp] = useState<Property | null>(null);
  const [similar, setSimilar] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // contact modal (for guest users inside dialog)
  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      const p = await fetchProperty(params.id);
      if (!ignore) {
        if (!p || p.status !== 'PUBLISHED') {
          setErr('Property not found.');
        } else {
          setProp(p);
          fetchSimilar(p.id).then(setSimilar);
        }
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [params.id]);

  const minRent = useMemo(() => {
    if (!prop?.units?.length) return null;
    return prop.units.reduce(
      (acc, u) => (acc === null ? u.rent : Math.min(acc, u.rent)),
      null as number | null
    );
  }, [prop]);

  const summary = useMemo(() => {
    if (!prop?.units?.length) return null;
    const totalAvail = prop.units.reduce((a, u) => a + (u.available ?? 0), 0);
    const first = prop.units[0];
    return {
      bedrooms: first?.bedrooms ?? 0,
      bathrooms: first?.bathrooms ?? 0,
      available: totalAvail,
    };
  }, [prop]);

  async function sharePage() {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      if (navigator.share) {
        await navigator.share({ title: prop?.title, text: prop?.description, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard.');
      }
    } catch {}
  }

  async function sendMessage() {
    if (!prop) return;
    setSending(true);
    try {
      const token = localStorage.getItem('rk_token');
      if (token && prop.lister?.id) {
        await fetch(`${API_BASE}/api/messages/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            propertyId: prop.id,
            toUserId: prop.lister.id,
            content: contactMsg || `Hi, I'm interested in ${prop.title}.`,
          }),
        });
      } else {
        await fetch(`${API_BASE}/api/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
            message: contactMsg,
            propertyId: prop.id,
          }),
        });
      }
      alert('Message sent.');
      setContactOpen(false);
      setContactMsg('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
    } catch {
      alert('Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <main className="container py-6">Loading…</main>;
  if (err || !prop)
    return (
      <main className="container py-16 text-center">
        <h1 className="text-2xl">Not found</h1>
        <p>{err || 'Unavailable'}</p>
      </main>
    );

  const statusLabel =
    prop.status === 'PUBLISHED'
      ? 'Available'
      : prop.status === 'UNPUBLISHED'
      ? 'Rented'
      : '';

  return (
    <main className="container py-6 space-y-8">
      {/* Hero slider */}
      <ImageSlider images={prop.images} minRent={minRent} onShare={sharePage} />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold">{prop.title}</h1>
            {statusLabel && (
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  statusLabel === 'Available'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {statusLabel}
              </span>
            )}
          </div>

          {/* Location */}
          <p className="text-gray-700 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-blue" />
            {prop.area ? `${prop.area}, ` : ''}
            {prop.location ? `${prop.location} — ` : ''}
            {prop.county || ''}
            {prop.constituency ? `, ${prop.constituency}` : ''}
            {prop.ward ? `, ${prop.ward}` : ''}
          </p>

          {/* Summary */}
          {summary && (
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100">
                <BedDouble className="h-4 w-4 text-brand-blue" /> {summary.bedrooms} Beds
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100">
                <Bath className="h-4 w-4 text-brand-blue" /> {summary.bathrooms} Baths
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100">
                Available: {summary.available}
              </span>
            </div>
          )}

          {/* Description */}
          <p className="text-gray-800 whitespace-pre-line">{prop.description}</p>

          {/* Price breakdown */}
          {prop.units && prop.units.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-lg">Units & Prices</h4>
              <ul className="space-y-1 text-sm">
                {prop.units.map((u) => (
                  <li key={u.id} className="flex justify-between border-b pb-1">
                    <span>
                      {u.type || 'Unit'} — {u.bedrooms} Bed / {u.bathrooms} Bath
                    </span>
                    <span>KES {formatKES(u.rent)} / month</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Amenities */}
          {prop.amenities && prop.amenities.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-lg">Amenities</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {prop.amenities.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                  >
                    {a.amenity?.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ContactCard */}
        <div className="space-y-4">
          <ContactCard lister={prop.lister ?? undefined} propertyId={prop.id} />
          {prop.lister?.createdAt && (
            <p className="text-xs text-gray-500 text-center">
              Lister since{' '}
              {new Date(prop.lister.createdAt).toLocaleDateString('en-KE', {
                year: 'numeric',
                month: 'short',
              })}
            </p>
          )}
        </div>
      </section>

      {/* Similar slider */}
      {similar.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Similar properties</h2>
            <Link
              href="/browse"
              className="text-brand-blue text-sm inline-flex items-center gap-1"
            >
              Browse more <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <div className="grid auto-cols-[240px] grid-flow-col gap-3">
              {similar.map((s) => (
                <Link
                  key={s.id}
                  href={`/properties/${s.id}`}
                  className="min-w-[240px] rounded-xl border shadow hover:shadow-md transition"
                >
                  <img
                    src={s.images?.[0]?.url ?? '/placeholder.webp'}
                    alt={s.title}
                    className="w-full h-36 object-cover rounded-t-xl"
                  />
                  <div className="p-3">
                    <div className="font-medium line-clamp-1">{s.title}</div>
                    <div className="text-sm text-gray-600 line-clamp-1">
                      {s.area ? `${s.area}, ` : ''}
                      {s.location ? `${s.location} — ` : ''}
                      {s.county || ''}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact modal for guests */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a message</DialogTitle>
            <DialogDescription>
              Ask about availability, viewing, or more details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Your name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <Input
              placeholder="Your email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
            <Input
              placeholder="Mobile number"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
            <textarea
              rows={5}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder={`Hi, I'm interested in "${prop.title}"…`}
              value={contactMsg}
              onChange={(e) => setContactMsg(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setContactOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button onClick={sendMessage} disabled={sending}>
              {sending ? 'Sending…' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}