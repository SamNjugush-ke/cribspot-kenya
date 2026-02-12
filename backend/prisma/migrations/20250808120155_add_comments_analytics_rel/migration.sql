/*
  Warnings:

  - You are about to drop the column `author` on the `Blog` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `BlogComment` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."BlogComment" DROP CONSTRAINT "BlogComment_parentId_fkey";

-- AlterTable
ALTER TABLE "public"."Blog" DROP COLUMN "author";

-- AlterTable
ALTER TABLE "public"."BlogComment" DROP COLUMN "parentId";

-- CreateTable
CREATE TABLE "public"."AnalyticsLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "path" TEXT,
    "referrer" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnalyticsLog" ADD CONSTRAINT "AnalyticsLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
