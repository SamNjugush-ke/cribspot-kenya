// src/components/CTA.tsx
import Link from 'next/link';

export function CTA() {
  return (
    <section className="py-10 bg-brand-blue text-white">
      <div className="max-w-3xl mx-auto text-center px-6">
        <h3 className="text-2xl font-bold">Ready to list your property?</h3>
        <p className="opacity-90 mt-2">
          Reach thousands of renters across Kenya in minutes.
        </p>
        <div className="flex justify-center gap-3 mt-6">
          <Link
            href="/lister"
            className="px-4 py-2 rounded-lg bg-white text-brand-blue font-semibold"
          >
            List Property
          </Link>
          <Link
            href="/browse"
            className="px-4 py-2 rounded-lg border border-white"
          >
            Browse Rentals
          </Link>
        </div>
      </div>
    </section>
  );
}
