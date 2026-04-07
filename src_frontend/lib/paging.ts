// frontend/src/lib/paging.ts
export function clampPage(n: number) {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function clampLimit(n: number, allowed = [10, 20, 50, 100]) {
  if (!Number.isFinite(n)) return allowed[1] ?? 20;
  const v = Math.floor(n);
  return allowed.includes(v) ? v : (allowed[1] ?? 20);
}

export function buildPageQuery(params: Record<string, any>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || String(v).trim() === "") return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}
