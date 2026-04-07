'use client';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { Permission } from "@/types/rbac";

export default function PermGroup({ title, items, value, onToggle }:{ title:string; items:Permission[]; value:Permission[]; onToggle:(p:Permission)=>void; }) {
  const allChecked = items.every(p => value.includes(p));
  const noneChecked = items.every(p => !value.includes(p));
  const selectAll = () => items.forEach(p => { if (!value.includes(p)) onToggle(p); });
  const clearAll = () => items.forEach(p => { if (value.includes(p)) onToggle(p); });
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">{title}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll} disabled={allChecked}>Select all</Button>
          <Button variant="outline" size="sm" onClick={clearAll} disabled={noneChecked}>Clear</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map(p => {
          const checked = value.includes(p);
          return (
            <label key={p} className="flex items-center gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={()=>onToggle(p)} />
              <span>{p}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
