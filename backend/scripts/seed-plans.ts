// scripts/seed-plans.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const plans = [
    { name: 'Starter', price: 499,  durationInDays: 30,  totalListings: 5,  featuredListings: 0,  isActive: true },
    { name: 'Pro',     price: 1499, durationInDays: 30,  totalListings: 20, featuredListings: 3,  isActive: true },
    { name: 'Business',price: 3499, durationInDays: 90,  totalListings: 80, featuredListings: 10, isActive: true },
  ];
  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: p.name },
      create: p,
      update: p,
    });
  }
  console.log('✅ Plans seeded/updated.');
}

main().finally(() => prisma.$disconnect());