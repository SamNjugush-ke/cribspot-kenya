'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPatch } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: 'LISTER' | 'RENTER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';
  createdAt: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Fetch current profile
  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await apiGet<{ user: UserProfile }>('/api/auth/me');
      if (res.ok && res.data?.user) {
        setProfile(res.data.user);
        setName(res.data.user.name);
        setPhone(res.data.user.phone ?? '');
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const res = await apiPatch(`/api/users/${profile.id}`, {
      name,
      phone,
    });
    if (res.ok) {
      alert('Profile updated successfully');
    } else {
      alert('Failed to update profile');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <section className="p-6">
        <p>Loading profile…</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="p-6">
        <p className="text-red-600">Could not load profile.</p>
      </section>
    );
  }

  return (
    <section className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="2547XXXXXXXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email (read-only)
            </label>
            <Input value={profile.email} disabled />
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-brand-blue text-white">{profile.role}</Badge>
            <span className="text-sm text-gray-600">
              Member since {new Date(profile.createdAt).toLocaleDateString()}
            </span>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-blue text-white"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
