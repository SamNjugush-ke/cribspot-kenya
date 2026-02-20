'use client';

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Unit = {
  id?: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  available: number;
  type: string;
};

export default function UnitEditor({
  value,
  onChange,
}: {
  value: Unit[];
  onChange: (v: Unit[]) => void;
}) {
  const [units, setUnits] = useState<Unit[]>(value || []);

  const update = (idx: number, patch: Partial<Unit>) => {
    const next = units.map((u, i) =>
      i === idx ? { ...u, ...patch } : u
    );
    setUnits(next);
    onChange(next);
  };

  const add = () => {
    const next = [
      ...units,
      {
        bedrooms: 1,
        bathrooms: 1,
        rent: 0,
        available: 1,
        type: "Apartment",
      },
    ];
    setUnits(next);
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = units.filter((_, i) => i !== idx);
    setUnits(next);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Units</h4>
        <button
          type="button"
          onClick={add}
          className="text-brand-blue text-sm"
        >
          + Add unit
        </button>
      </div>

      {units.length === 0 && (
        <p className="text-sm text-gray-600">
          No units yet. Click “Add unit”.
        </p>
      )}

      {units.map((u, idx) => (
        <div
          key={idx}
          className="grid grid-cols-2 md:grid-cols-6 gap-2 border rounded-lg p-3"
        >
          <div>
            <Label>Type</Label>
            <Select
              value={u.type}
              onValueChange={(val) => update(idx, { type: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Apartment">Apartment</SelectItem>
                <SelectItem value="Studio/Bedsitter">Studio</SelectItem>
                <SelectItem value="Bungalow">Bungalow</SelectItem>
                <SelectItem value="Townhouse">Townhouse</SelectItem>                              
                <SelectItem value="Mansion">Townhouse</SelectItem>                 
                <SelectItem value="Hostel">Townhouse</SelectItem>                                 
                <SelectItem value="Office">Townhouse</SelectItem>                               
                <SelectItem value="Shop">Townhouse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Bedrooms</Label>
            <Input
              type="number"
              min={0}
              value={u.bedrooms}
              onChange={(e) =>
                update(idx, { bedrooms: Number(e.target.value) })
              }
            />
          </div>

          <div>
            <Label>Bathrooms</Label>
            <Input
              type="number"
              min={0}
              value={u.bathrooms}
              onChange={(e) =>
                update(idx, { bathrooms: Number(e.target.value) })
              }
            />
          </div>

          <div>
            <Label>Rent (KES)</Label>
            <Input
              type="number"
              min={0}
              value={u.rent}
              onChange={(e) =>
                update(idx, { rent: Number(e.target.value) })
              }
            />
          </div>

          <div>
            <Label>Available</Label>
            <Input
              type="number"
              min={0}
              value={u.available}
              onChange={(e) =>
                update(idx, { available: Number(e.target.value) })
              }
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-red-600 text-sm"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}