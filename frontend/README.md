# Rentals Kenya — Fresh Frontend

A clean, modern Next.js (App Router + TS) frontend aligned to your brand and wired to your backend APIs.

## Quick start
```bash
cd frontend
npm i
cp .env.local.sample .env.local   # set NEXT_PUBLIC_API_BASE
npm run dev
```

## Pages & Sections
- Sticky Header: logo left, actions right (List, Sign Up, Login)
- Hero with background + Search (Type, Bedrooms, Min/Max Price, Advanced amenities)
- Featured Listings (4×2 grid slider) — `/api/properties?featured=true`
- New Listings (4×1 slider, recent) — `/api/properties?sort=createdAt:desc`
- CTA band
- County/Area explorer with **Top** and **A–Z** tabs; optional endpoints:
  - `GET /api/properties/stats/counties` → `[ { name, count } ]`
  - `GET /api/properties/areas?county=Kiambu` → `{ areas: [] }`
- Blog "Property Advice" slider — `GET /api/blogs`
- Footer with newsletter subscribe (optional POST `/api/marketing/subscribe`)

## Detail pages
- `/featured` — all featured properties
- `/browse` — grid results (accepts query params from SearchBar)
- `/properties/[id]` — calls `GET /api/properties/full/:id`
- `/counties/[county]` — list by county (calls `/api/properties?county=...`)
- `/areas/[county]/[area]` — list by area (calls `/api/properties?county=...&area=...`)

## Branding (Tailwind)
Defined in `tailwind.config.js`:
- Royal Blue `#004AAD` → `bg-brand-blue` / `text-brand-blue`
- Crimson Red `#D62828` → `bg-brand-red`
- Sky `#3FA9F5` → `bg-brand-sky`
- Base colors: `brand-black`, `brand-gray`, `brand-white`

## Customize
- Replace `/public/hero.jpg` with your image
- Update `/public/logo.svg`
- Tune sliders in `FeaturedSlider.tsx`, `NewListingsSlider.tsx`, `BlogSlider.tsx`

## Notes
- Axios client attaches `Authorization: Bearer <token>` from `localStorage` if present
- If optional endpoints are missing, UI falls back gracefully
- Later sprints: shadcn/ui components, PWA, socket.io for chat, analytics logger
