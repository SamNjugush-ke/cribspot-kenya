'use client';
import Guard from "@/components/auth/Guard";

export default function RenterHome() {
  return (
    <Guard allowed={["RENTER"]}>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Renter Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm text-gray-600">Metric</div>
            <div className="text-2xl font-semibold">—</div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm text-gray-600">Metric</div>
            <div className="text-2xl font-semibold">—</div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm text-gray-600">Metric</div>
            <div className="text-2xl font-semibold">—</div>
          </div>
        </div>
      </div>
    </Guard>
  );
}
