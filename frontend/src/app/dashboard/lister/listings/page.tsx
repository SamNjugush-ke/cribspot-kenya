'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiDelete, apiPatch } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  Edit,
  Trash2,
  Search,
  BedDouble,
  Bath,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type Unit = {
  id: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  type: string;
};

type Property = {
  id: string;
  title: string;
  description?: string;
  location: string;
  county?: string | null;
  constituency?: string | null;
  ward?: string | null;
  createdAt: string;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  featured?: boolean;
  images: { url: string }[];
  units: Unit[];
  amenities?: { amenity: { name: string } }[];
};

export default function MyListingsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filtered, setFiltered] = useState<Property[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [editing, setEditing] = useState<Property | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRent, setEditRent] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  async function fetchListings() {
    const res = await apiGet<{ items: Property[]; total: number }>(
      `/api/properties/mine?page=${page}&limit=${limit}`
    );
    if (res.ok && res.data) {
      setProperties(res.data.items);
      setFiltered(res.data.items);
    }
  }

  useEffect(() => {
    fetchListings();
  }, [page, limit]);

  // Handle search + filter
  useEffect(() => {
    let data = [...properties];
    if (search.trim()) {
      data = data.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter !== 'All') {
      data = data.filter((p) => {
        if (statusFilter === 'Featured') return p.featured;
        if (statusFilter === 'Drafts') return p.status === 'DRAFT';
        if (statusFilter === 'Published') return p.status === 'PUBLISHED';
        if (statusFilter === 'Unpublished') return p.status === 'UNPUBLISHED';
        return true;
      });
    }
    setFiltered(data);
  }, [search, statusFilter, properties]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    const res = await apiDelete(`/api/properties/${id}`);
    if (res.ok) {
      setProperties((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const openEdit = (p: Property) => {
    setEditing(p);
    setEditTitle(p.title);
    setEditDescription(p.description || '');
    setEditRent(p.units?.[0]?.rent || '');
  };

  const saveChanges = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await apiPatch(`/api/properties/${editing.id}`, {
      title: editTitle,
      description: editDescription,
      // rent simplified: apply to first unit for demo
      units: editing.units.map((u) => ({
        ...u,
        rent: Number(editRent) || u.rent,
      })),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(null);
      fetchListings();
    } else {
      alert('Failed to save changes');
    }
  };

  const toggleFeature = async () => {
    if (!editing) return;
    const res = await apiPatch(`/api/properties/${editing.id}`, {
      featured: !editing.featured,
    });
    if (res.ok) {
      setEditing({ ...editing, featured: !editing.featured });
      fetchListings();
    } else {
      alert('Failed to toggle feature');
    }
  };

  const changeStatus = async (newStatus: 'PUBLISHED' | 'UNPUBLISHED') => {
    if (!editing) return;
    let res;
    if (newStatus === 'PUBLISHED') {
      res = await apiPatch(`/api/properties/${editing.id}/publish`, {});
    } else {
      res = await apiPatch(`/api/properties/${editing.id}/status`, {
        newStatus,
      });
    }
    if (res.ok) {
      setEditing(null);
      fetchListings();
    } else {
      alert('Failed to update status');
    }
  };

  return (
    <section className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">My Listings</h1>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-1/2">
          <Input
            placeholder="Search Properties"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
          <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="All">All</option>
          <option value="Published">Published</option>
          <option value="Unpublished">Unpublished</option>
          <option value="Featured">Featured</option>
          <option value="Drafts">Drafts</option>
        </select>
      </div>

      {/* Listings Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Photo</th>
              <th className="p-3">Property Info</th>
              <th className="p-3">Added On</th>
              <th className="p-3">Status</th>
              <th className="p-3">Rent (KES)</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.images?.[0]?.url || '/placeholder.webp'}
                    alt={p.title}
                    className="h-16 w-20 object-cover rounded"
                  />
                </td>
                <td className="p-3">
                  <div className="font-medium">{p.title}</div>
                  <div className="flex gap-3 text-xs text-gray-600 mt-1">
                    {p.units[0]?.bedrooms >= 0 && (
                      <span className="flex items-center gap-1">
                        <BedDouble className="h-4 w-4" />
                        {p.units[0].bedrooms}
                      </span>
                    )}
                    {p.units[0]?.bathrooms >= 0 && (
                      <span className="flex items-center gap-1">
                        <Bath className="h-4 w-4" />
                        {p.units[0].bathrooms}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  {new Date(p.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3 space-y-1">
                  <Badge className="bg-brand-blue text-white">
                    {p.status}
                  </Badge>
                  {p.featured && (
                    <Badge className="bg-yellow-500 text-white">Featured</Badge>
                  )}
                </td>
                <td className="p-3">
                  {p.units[0]?.rent?.toLocaleString() || '-'}
                </td>
                <td className="p-3 text-right space-x-2">
                  <Link href={`/properties/${p.id}`} target="_blank">
                    <Button
                      size="icon"
                      variant="outline"
                      className="text-brand-blue"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    size="icon"
                    variant="outline"
                    className="text-green-600"
                    onClick={() => openEdit(p)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="text-red-600"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Property</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={editing.status === 'PUBLISHED'}
              />
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
              <Input
                type="number"
                value={editRent}
                onChange={(e) => setEditRent(e.target.value ? Number(e.target.value) : '')}
              />
            </div>
          )}

          <DialogFooter className="flex justify-between mt-4">
            {editing?.status === 'DRAFT' && (
              <Button onClick={() => changeStatus('PUBLISHED')} className="bg-brand-blue text-white">
                Publish
              </Button>
            )}
            {editing?.status === 'PUBLISHED' && (
              <>
                <Button onClick={() => changeStatus('UNPUBLISHED')} variant="outline">
                  Unpublish
                </Button>
                <Button onClick={toggleFeature} variant="secondary">
                  {editing.featured ? 'Unfeature' : 'Feature'}
                </Button>
              </>
            )}
            {editing?.status === 'UNPUBLISHED' && (
              <Button onClick={() => changeStatus('PUBLISHED')} className="bg-brand-blue text-white">
                Publish
              </Button>
            )}

            <Button onClick={saveChanges} disabled={saving} className="bg-green-600 text-white">
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
        <div>
          Show{' '}
          <select
            className="border rounded px-2 py-1"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>{' '}
          entries
        </div>
        <div>
          Entries {(page - 1) * limit + 1}-
          {Math.min(page * limit, properties.length)} of {properties.length}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Prev
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}