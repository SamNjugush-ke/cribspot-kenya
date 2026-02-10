import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const DEFAULT_AMENITIES = [
  "Parking",
  "Own Compound",
  "Lift",
  "Balcony",
  "Garden",
  "Gym",
  "Swimming Pool",
  "Backup Generator",
  "CCTV",
  "24/7 Security",
];

async function main() {
  for (const name of DEFAULT_AMENITIES) {
    await prisma.amenity.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("✅ Amenities seeded");
}

main().finally(() => prisma.$disconnect());