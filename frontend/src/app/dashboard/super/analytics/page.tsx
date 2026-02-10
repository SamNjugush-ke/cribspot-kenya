'use client';

import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/auth/Guard';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/apiClient';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// Backend summary is nested (e.g. users.total, listings.total, payments.totalAmount)
type Summary = {
  users?: { total?: number; listers?: number; renters?: number };
  listings?: { total?: number; published?: number; drafts?: number };
  payments?: { totalAmount?: number; totalCount?: number; successCount?: number };
  subscriptions?: { active?: number; total?: number };
};

type Revenue = { month: string; total: number };
type SubStatus = { active: number; expired: number };

// Normalize whatever Prisma returns for groupBy _count
type DistributionRaw = { county: string | null; _count: any };
type Distribution = { county: string; count: number };

export default function AnalyticsPage() {
  return (
    <Guard allowed={['SUPER_ADMIN']}>
      <AnalyticsInner />
    </Guard>
  );
}

function AnalyticsInner() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [distribution, setDistribution] = useState<Distribution[]>([]);
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    try {
      const [s, r, d, ss] = await Promise.all([
        apiFetch<Summary>('/api/analytics/summary'),
        apiFetch<Revenue[]>('/api/analytics/revenue'),
        apiFetch<DistributionRaw[]>('/api/analytics/distribution/county'),
        apiFetch<SubStatus>('/api/analytics/subscriptions/status'),
      ]);

      setSummary(s ?? null);
      setRevenue(Array.isArray(r) ? r : []);

      const normalized = (Array.isArray(d) ? d : []).map((x) => {
        const county = x.county ?? 'Unknown';

        let count = 0;
        const c = x._count;

        if (typeof c === 'number') count = c;
        else if (c && typeof c === 'object') {
          // common shapes: {_all: n} or {id: n}
          count = Number(c._all ?? c.id ?? 0);
        }

        return { county, count };
      });

      setDistribution(normalized);
      setSubStatus(ss ?? null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to load analytics');
    }
  }

  const distForChart = useMemo(() => {
    const sorted = [...distribution].sort((a, b) => b.count - a.count);
    return sorted.slice(0, 12);
  }, [distribution]);

  // KPI values derived from nested summary shape
  const kpiUsers = Number(summary?.users?.total ?? 0);
  const kpiListers = Number(summary?.users?.listers ?? 0);
  const kpiListings = Number(summary?.listings?.total ?? 0);
  const kpiPaymentsKes = Number(summary?.payments?.totalAmount ?? 0);
  const kpiSubscriptions = Number(summary?.subscriptions?.active ?? summary?.subscriptions?.total ?? 0);

  return (
    <section className="space-y-8">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <button
          className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-brand-gray"
          onClick={loadData}
        >
          Refresh
        </button>
      </div>

      {/* KPI Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Users</div>
              <div className="text-2xl font-semibold">{kpiUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Listers</div>
              <div className="text-2xl font-semibold">{kpiListers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Listings</div>
              <div className="text-2xl font-semibold">{kpiListings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Payments</div>
              <div className="text-2xl font-semibold">
                KES {kpiPaymentsKes.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Subscriptions</div>
              <div className="text-2xl font-semibold">{kpiSubscriptions}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue by Month */}
      {revenue.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-4">Revenue (last 12 months)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#004AAD" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Property Distribution by County */}
      {distForChart.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-4">Property Distribution (Top 12 counties)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distForChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="county" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3FA9F5" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Subscription Status Pie */}
      {subStatus && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-4">Subscriptions Status</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active', value: subStatus.active },
                    { name: 'Expired', value: subStatus.expired },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(props: any) => {
                    const { name, percent } = props;
                    return `${name} ${(percent * 100).toFixed(0)}%`;
                  }}
                  outerRadius={120}
                  dataKey="value"
                >
                  <Cell fill="#00C49F" />
                  <Cell fill="#FF8042" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </section>
  );
}