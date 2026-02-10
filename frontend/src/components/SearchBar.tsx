'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AMENITIES, BEDROOM_OPTIONS, PROPERTY_TYPES } from '@/lib/constants';

export function SearchBar() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [beds, setBeds] = useState('Any');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [adv, setAdv] = useState(false);
  const [amen, setAmen] = useState<string[]>([]);

  const toggleAmen = (a: string) => {
    setAmen((prev) => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  const onSearch = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    if (beds && beds !== 'Any') params.set('bedrooms', beds.replace('+',''));
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (amen.length) params.set('amenities', amen.join(','));
    router.push(`/browse?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-xl shadow-soft border p-3 md:p-4">
      <div className="flex flex-col md:flex-row gap-2">
        <input
          value={q} onChange={(e)=>setQ(e.target.value)}
          placeholder="Search location, estate, or title..."
          className="flex-1 rounded-lg border px-3 py-2"
        />
        <select value={type} onChange={(e)=>setType(e.target.value)} className="rounded-lg border px-3 py-2">
          <option value="">Type</option>
          {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={beds} onChange={(e)=>setBeds(e.target.value)} className="rounded-lg border px-3 py-2">
          {BEDROOM_OPTIONS.map(b => <option key={b} value={b}>{b} Bedrooms</option>)}
        </select>
        <input value={minPrice} onChange={(e)=>setMinPrice(e.target.value)} placeholder="Min Price" className="w-28 rounded-lg border px-3 py-2" />
        <input value={maxPrice} onChange={(e)=>setMaxPrice(e.target.value)} placeholder="Max Price" className="w-28 rounded-lg border px-3 py-2" />
        <button onClick={onSearch} className="px-4 py-2 rounded-lg bg-brand-blue text-white">Search</button>
      </div>

      <div className="mt-2 flex items-center gap-3 text-sm">
        <button onClick={() => setAdv(v => !v)} className="text-brand-blue underline">Advanced</button>
        <span className="text-gray-500">Amenities</span>
      </div>

      {adv && (
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm">
          {AMENITIES.map(a => (
            <label key={a} className="flex items-center gap-2">
              <input type="checkbox" checked={amen.includes(a)} onChange={()=>toggleAmen(a)} />
              <span className="capitalize">{a}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
