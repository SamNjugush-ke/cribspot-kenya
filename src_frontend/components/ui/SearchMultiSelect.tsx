'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type SelectItem = { id: string; name: string };

type Props = {
  label: string;
  placeholder?: string;
  selectedIds: string[];
  selectedItems?: SelectItem[]; // optional to show names if you already have them
  onChange: (ids: string[], items?: SelectItem[]) => void;

  // search endpoint that returns SelectItem[]
  onSearch: (q: string) => Promise<SelectItem[]>;

  // allow creating new item (optional)
  allowCreate?: boolean;
  onCreate?: (name: string) => Promise<SelectItem>; // must return created item
  disabled?: boolean;

  helperText?: string;
};

export default function SearchMultiSelect({
  label,
  placeholder,
  selectedIds,
  selectedItems,
  onChange,
  onSearch,
  allowCreate,
  onCreate,
  disabled,
  helperText,
}: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<SelectItem[]>([]);
  const [knownSelected, setKnownSelected] = useState<SelectItem[]>(selectedItems || []);

  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (Array.isArray(selectedItems)) setKnownSelected(selectedItems);
  }, [selectedItems]);

  // close dropdown on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const selectedMap = useMemo(() => {
    const m = new Map<string, SelectItem>();
    for (const it of knownSelected) m.set(it.id, it);
    return m;
  }, [knownSelected]);

  const selectedDisplay = useMemo(() => {
    // ensure we show chips even if we only have IDs (fallback to ID)
    return selectedIds.map((id) => selectedMap.get(id) || ({ id, name: id } as SelectItem));
  }, [selectedIds, selectedMap]);

  // debounced search
  useEffect(() => {
    let t: any;
    const run = async () => {
      const query = q.trim();
      if (!open) return;
      setBusy(true);
      try {
        const data = await onSearch(query);
        setResults(Array.isArray(data) ? data : []);
      } finally {
        setBusy(false);
      }
    };
    t = setTimeout(run, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open]);

  const toggle = (it: SelectItem) => {
    const exists = selectedIds.includes(it.id);
    let nextIds = exists ? selectedIds.filter((x) => x !== it.id) : [...selectedIds, it.id];

    // keep names for selected
    let nextKnown = [...knownSelected];
    if (!exists) {
      if (!nextKnown.find((x) => x.id === it.id)) nextKnown.push(it);
    } else {
      // keep it in knownSelected even if removed; harmless, but you can prune if you want
    }

    setKnownSelected(nextKnown);
    onChange(nextIds, nextKnown);
  };

  const remove = (id: string) => {
    const nextIds = selectedIds.filter((x) => x !== id);
    onChange(nextIds, knownSelected);
  };

  const canCreate = allowCreate && onCreate && q.trim().length >= 2;

  const createNew = async () => {
    if (!canCreate || !onCreate) return;
    const name = q.trim();
    setCreating(true);
    try {
      const created = await onCreate(name);
      // auto-select created
      const nextIds = selectedIds.includes(created.id) ? selectedIds : [...selectedIds, created.id];
      const nextKnown = knownSelected.find((x) => x.id === created.id)
        ? knownSelected
        : [...knownSelected, created];
      setKnownSelected(nextKnown);
      onChange(nextIds, nextKnown);
      setQ('');
      setOpen(true);
    } finally {
      setCreating(false);
    }
  };

  const filteredResults = useMemo(() => {
    // hide already selected from dropdown for cleanliness
    const set = new Set(selectedIds);
    return results.filter((r) => !set.has(r.id));
  }, [results, selectedIds]);

  return (
    <div ref={boxRef} className="space-y-2">
      <div className="text-xs font-semibold text-gray-600">{label}</div>

      {/* selected chips */}
      <div className={cn('flex flex-wrap gap-2', disabled && 'opacity-60')}>
        {selectedDisplay.length === 0 ? (
          <div className="text-xs text-gray-500">None selected</div>
        ) : (
          selectedDisplay.map((it) => (
            <span
              key={it.id}
              className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-xs"
            >
              <span className="max-w-[200px] truncate">{it.name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  className="rounded-full p-0.5 hover:bg-gray-100"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {/* input + dropdown */}
      <div className="relative">
        <Input
          disabled={disabled}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || 'Search...'}
        />

        {open && !disabled && (
          <div className="absolute z-20 mt-2 w-full rounded-lg border bg-white shadow-sm">
            <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-600 border-b">
              <span>{busy ? 'Searching…' : 'Results'}</span>
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>

            <div className="max-h-64 overflow-auto">
              {filteredResults.length === 0 && !busy ? (
                <div className="px-3 py-3 text-sm text-gray-600">
                  No matches.
                  {canCreate && (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={createNew}
                        disabled={creating}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {creating ? 'Creating…' : `Create "${q.trim()}"`}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <ul className="py-1">
                  {filteredResults.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => toggle(it)}
                      >
                        {it.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-3 py-2 border-t text-xs text-gray-500">
              Click to select. Selected items appear as chips above.
            </div>
          </div>
        )}
      </div>

      {helperText ? <div className="text-xs text-gray-500">{helperText}</div> : null}
    </div>
  );
}
