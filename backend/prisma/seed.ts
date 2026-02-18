import bcrypt from "bcryptjs";
import prisma from "../src/utils/prisma";
import { Prisma, Role } from "@prisma/client";

/** ---------------- Helpers ---------------- */
function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function excerptFromHtml(html: string, max = 160) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function readingTimeFromHtml(html: string) {
  const words = html
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function upsertUser(opts: {
  email: string;
  name: string;
  role: Role;
  passwordPlain: string;
}) {
  const passwordHash = await bcrypt.hash(opts.passwordPlain, 10);

  // Upsert by unique email. Always set role + name, and set password only if blank.
  // (If you want to always overwrite password, move passwordHash into update below.)
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });

  if (!existing) {
    return prisma.user.create({
      data: {
        email: opts.email,
        name: opts.name,
        role: opts.role,
        password: passwordHash,
      },
      select: { id: true, email: true, role: true, name: true },
    });
  }

  return prisma.user.update({
    where: { email: opts.email },
    data: {
      name: opts.name,
      role: opts.role,
      ...(existing.password ? {} : { password: passwordHash }),
    },
    select: { id: true, email: true, role: true, name: true },
  });
}

/** ---------------- Seed data ---------------- */
const SEED_PASSWORD = process.env.SEED_PASSWORD || "Cribspot@123";

const CATEGORY_NAMES = [
  "Renting Tips",
  "Market Trends",
  "Legal & Lease",
  "Neighbourhoods",
  "Money & Budget",
  "Safety & Security",
  "Furnishing & Decor",
  "Landlord Relations",
];

const TAG_NAMES = [
  "Kenya",
  "Nairobi",
  "Apartments",
  "Houses",
  "Budget",
  "Lease",
  "Safety",
  "Furniture",
  "Negotiation",
  "Moving",
];

type BlogSeed = {
  title: string;
  baseSlug: string;
  cover: string;
  paragraphs: string[];
  categories: string[];
  tags: string[];
  author: "EDNA" | "ALICE";
  ageDays?: number;
};

const BLOGS: BlogSeed[] = [
  {
    title: "Tips for First-Time Renters",
    baseSlug: "tips-for-first-time-renters",
    cover: "/uploads/blogs/renters-tips.jpg",
    paragraphs: [
      `<p>Renting your first home is exciting — and a little daunting. Before you sign, make a checklist of your absolute must-haves: location, budget, transport, and essentials like security and water pressure. Always visit at different times of day to gauge traffic, noise, and safety.</p>`,
      `<p>When you view a unit, don’t be shy about testing everything. Turn on taps and lights, check for damp spots, ask about backup power/water, and read the house rules. If something seems off, it probably is — ask follow-up questions.</p>`,
      `<p>Finally, prepare your paperwork early. Have copies of your ID, payslips or bank statements, and references ready. A tidy application shows you’re serious and helps you secure the unit ahead of other applicants.</p>`,
    ],
    categories: ["Renting Tips", "Money & Budget"],
    tags: ["Kenya", "Budget", "Moving"],
    author: "EDNA",
    ageDays: 1,
  },
  {
    title: "How to Choose the Right Property",
    baseSlug: "how-to-choose-the-right-property",
    cover: "/uploads/blogs/right-property.jpg",
    paragraphs: [
      `<p>Start with location. Shorter commutes save time and money, and nearby amenities — supermarkets, clinics, parks — quickly become priceless. Weigh trade-offs honestly: a larger home far from work may cost more in daily transport.</p>`,
      `<p>Next, set a realistic budget including hidden expenses: service charges, parking, garbage, and internet. Ask the landlord to itemize monthly costs so there are no surprises after moving in.</p>`,
      `<p>Finally, trust your gut. A welcoming landlord, transparent terms, and a property that feels safe are all green flags. If you’re unsure, keep looking — the right place is worth the wait.</p>`,
    ],
    categories: ["Neighbourhoods", "Market Trends"],
    tags: ["Nairobi", "Apartments", "Houses"],
    author: "ALICE",
    ageDays: 3,
  },
  {
    title: "Saving Money on Rent",
    baseSlug: "saving-money-on-rent",
    cover: "/uploads/blogs/save-rent.jpg",
    paragraphs: [
      `<p>Negotiate respectfully. Lead with market data — show recent listings in the area and ask whether there’s flexibility on price, deposit, or move-in date. Landlords often value reliable tenants more than a slightly higher rent.</p>`,
      `<p>Share and save. If the layout allows, a roommate can halve your monthly costs. Just agree on house rules, guests, and chores up front to avoid tension.</p>`,
      `<p>Track your expenses. Small, recurring costs (streaming, delivery, taxis) add up. A simple budget frees up cash for savings or a better location next year.</p>`,
    ],
    categories: ["Money & Budget"],
    tags: ["Budget", "Negotiation"],
    author: "EDNA",
    ageDays: 5,
  },
  {
    title: "Understanding Lease Agreements",
    baseSlug: "understanding-lease-agreements",
    cover: "/uploads/blogs/lease-agreement.jpg",
    paragraphs: [
      `<p>Never sign a lease you haven’t read word-for-word. Confirm the rent, deposit, notice period, and who pays for utilities, maintenance, and repairs. Ask what happens during outages and whether pets or subletting are allowed.</p>`,
      `<p>Look for break clauses. Life changes — jobs move, families grow — and you may need to leave early. A fair clause outlines fees and notice, protecting both sides.</p>`,
      `<p>Get everything in writing. If the landlord promises repainting, a new cooker, or a different move-in date, have it added to the lease or a signed addendum.</p>`,
    ],
    categories: ["Legal & Lease"],
    tags: ["Lease", "Safety"],
    author: "ALICE",
    ageDays: 7,
  },
  {
    title: "Top Neighbourhoods in Nairobi",
    baseSlug: "top-neighbourhoods-nairobi",
    cover: "/uploads/blogs/nairobi-neighbourhoods.jpg",
    paragraphs: [
      `<p>Kilimani blends convenience with culture — cafés, gyms, and quick CBD access. Westlands buzzes with nightlife and offices, while Lavington offers quieter streets and bigger homes.</p>`,
      `<p>Consider upcoming hotspots like Kileleshwa and Ruaka for better value, or South B for quick links to Mombasa Road and the airport. Always visit on weekdays and weekends to feel the vibe.</p>`,
      `<p>Match your lifestyle: remote workers might want quieter streets and reliable internet; social butterflies may prefer proximity to restaurants and malls.</p>`,
    ],
    categories: ["Neighbourhoods", "Market Trends"],
    tags: ["Nairobi", "Apartments", "Houses"],
    author: "EDNA",
    ageDays: 9,
  },
  {
    title: "Furnishing Your Rental on a Budget",
    baseSlug: "furnishing-rental-on-budget",
    cover: "/uploads/blogs/furnishing-budget.jpg",
    paragraphs: [
      `<p>Start with multipurpose pieces: a sofa-bed for guests, nesting tables, and storage ottomans. Measure before you buy — returns are costly and time-consuming.</p>`,
      `<p>Second-hand can be brilliant. Check trusted marketplaces and thrift stores, and don’t be afraid of a DIY refresh with paint or new handles. Plants add life without breaking the bank.</p>`,
      `<p>Work in layers: a neutral base with colourful cushions, throws, and art you can take when you move. Your space should feel like yours — even on a budget.</p>`,
    ],
    categories: ["Furnishing & Decor"],
    tags: ["Furniture", "Budget"],
    author: "ALICE",
    ageDays: 11,
  },
  {
    title: "Safety Tips for Tenants",
    baseSlug: "safety-tips-for-tenants",
    cover: "/uploads/blogs/safety-tips.jpg",
    paragraphs: [
      `<p>Check locks, lighting, and sightlines. Well-lit entrances and working bolts deter opportunists. Ask neighbours how secure the compound feels at night.</p>`,
      `<p>Keep a simple emergency kit: torches, power bank, first-aid, and key contacts. Label your main breaker and gas shut-off to act quickly in an emergency.</p>`,
      `<p>Online safety counts too. Don’t overshare your address or routines on social media, and meet marketplace sellers in public places first.</p>`,
    ],
    categories: ["Safety & Security"],
    tags: ["Safety", "Kenya"],
    author: "EDNA",
    ageDays: 13,
  },
  {
    title: "How to Handle Landlord Disputes",
    baseSlug: "handle-landlord-disputes",
    cover: "/uploads/blogs/landlord-disputes.jpg",
    paragraphs: [
      `<p>Document everything — photos, dates, and messages. Stay calm and propose clear solutions with timelines. Most issues resolve faster when you’re factual, not emotional.</p>`,
      `<p>If talks stall, check your lease and local laws. Mediation services or tenants’ associations can help both sides reach a fair outcome.</p>`,
      `<p>When you agree on a fix, confirm in writing. A short email recap avoids “he said, she said” later and keeps the relationship professional.</p>`,
    ],
    categories: ["Landlord Relations", "Legal & Lease"],
    tags: ["Negotiation", "Lease"],
    author: "ALICE",
    ageDays: 15,
  },
];

/** ---------------- Upserts ---------------- */
async function upsertCategories() {
  const map = new Map<string, string>();
  for (const name of CATEGORY_NAMES) {
    const slug = slugify(name);
    const cat = await prisma.category.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
      select: { id: true, name: true, slug: true },
    });
    map.set(name, cat.id);
  }
  return map;
}

async function upsertTags() {
  const map = new Map<string, string>();
  for (const name of TAG_NAMES) {
    const slug = slugify(name);
    // Tag model has unique on name and slug; upsert on slug is safest
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
      select: { id: true, name: true, slug: true },
    });
    map.set(name, tag.id);
  }
  return map;
}

async function seedUsers() {
  console.log("👤 Seeding users… (password:", SEED_PASSWORD, ")");

  const superAdmin = await upsertUser({
    email: "superadmin@cribspot.co.ke",
    name: "Raphael Muriuki",
    role: Role.SUPER_ADMIN,
    passwordPlain: SEED_PASSWORD,
  });

  const lister = await upsertUser({
    email: "generallister@cribspot.co.ke",
    name: "Larry Lister",
    role: Role.LISTER,
    passwordPlain: SEED_PASSWORD,
  });

  const edna = await upsertUser({
    email: "editor@cribspot.co.ke",
    name: "Edna Editor",
    role: Role.EDITOR,
    passwordPlain: SEED_PASSWORD,
  });

  const alice = await upsertUser({
    email: "alice@cribspot.co.ke",
    name: "Alice Editor",
    role: Role.EDITOR,
    passwordPlain: SEED_PASSWORD,
  });

  return { superAdmin, lister, edna, alice };
}

async function seedBlogs(
  catMap: Map<string, string>,
  tagMap: Map<string, string>,
  authorIds: { EDNA: string; ALICE: string }
) {
  console.log("📝 Seeding blogs…");

  for (let i = 0; i < BLOGS.length; i++) {
    const b = BLOGS[i];
    const html = b.paragraphs.join("\n");
    const excerpt = excerptFromHtml(html, 180);
    const reading = readingTimeFromHtml(html);

    // IMPORTANT: stable slug so seed is idempotent
    // (no random suffix)
    const slug = slugify(b.baseSlug || b.title);

    const authorId = b.author === "EDNA" ? authorIds.EDNA : authorIds.ALICE;
    const publishedAt = new Date(Date.now() - (b.ageDays || 0) * 86400000);

    const blog = await prisma.blog.upsert({
      where: { slug },
      update: {
        title: b.title,
        coverImage: b.cover,
        excerpt,
        contentHtml: html,
        contentText: excerptFromHtml(html, 10_000),
        readingTimeMins: reading,
        published: true,
        publishedAt,
        authorId,
        contentJson: Prisma.JsonNull, // HTML only for seed
        contentFormat: "TIPTAP",
      },
      create: {
        title: b.title,
        slug,
        coverImage: b.cover,
        excerpt,
        contentHtml: html,
        contentText: excerptFromHtml(html, 10_000),
        readingTimeMins: reading,
        published: true,
        publishedAt,
        authorId,
        contentJson: Prisma.JsonNull,
        contentFormat: "TIPTAP",
      },
      select: { id: true, slug: true },
    });

    // categories
    const catIds = (b.categories || [])
      .map((name) => catMap.get(name))
      .filter(Boolean) as string[];

    for (const cid of catIds) {
      await prisma.blogCategory.upsert({
        where: { blogId_categoryId: { blogId: blog.id, categoryId: cid } },
        update: {},
        create: { blogId: blog.id, categoryId: cid },
      });
    }

    // tags
    const tagIds = (b.tags || [])
      .map((name) => tagMap.get(name))
      .filter(Boolean) as string[];

    for (const tid of tagIds) {
      await prisma.blogTag.upsert({
        where: { blogId_tagId: { blogId: blog.id, tagId: tid } },
        update: {},
        create: { blogId: blog.id, tagId: tid },
      });
    }
  }
}

/** ---------------- Main ---------------- */
async function main() {
  console.log("🌱 Starting seed…");

  const users = await seedUsers();

  console.log("🏷️  Seeding categories & tags…");
  const catMap = await upsertCategories();
  const tagMap = await upsertTags();

  await seedBlogs(catMap, tagMap, { EDNA: users.edna.id, ALICE: users.alice.id });

  console.log("✅ Seed complete.");
  console.log("Logins:");
  console.log(" - SUPER_ADMIN: superadmin@cribspot.co.ke /", SEED_PASSWORD);
  console.log(" - LISTER:      generallister@cribspot.co.ke /", SEED_PASSWORD);
  console.log(" - EDITOR:      editor@cribspot.co.ke /", SEED_PASSWORD);
  console.log(" - EDITOR:      alice@cribspot.co.ke /", SEED_PASSWORD);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });