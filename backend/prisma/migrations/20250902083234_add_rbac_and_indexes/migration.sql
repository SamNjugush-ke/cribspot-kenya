/*
  Warnings:

  - A unique constraint covering the columns `[userId,propertyId]` on the table `Favorite` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."AgentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."BoostStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."Permission" AS ENUM ('ACCESS_FULL_ANALYTICS', 'VIEW_OWN_PERFORMANCE', 'VIEW_ALL_MESSAGES', 'REPLY_MESSAGES', 'BULK_NOTIFICATIONS', 'MANAGE_BLOG_SETTINGS', 'BLOG_CRUD', 'MODERATE_COMMENTS', 'SEND_ANNOUNCEMENTS', 'CONFIGURE_PAYMENT_GATEWAYS', 'VIEW_TRANSACTIONS_ALL', 'MANUAL_REFUND', 'VIEW_OWN_INVOICES', 'MANAGE_PACKAGES', 'ASSIGN_PACKAGES', 'ENFORCE_QUOTAS', 'VIEW_QUOTA_DASHBOARDS', 'VIEW_OWN_QUOTA', 'APPROVE_LISTINGS', 'FEATURE_LISTINGS', 'REMOVE_FLAG_LISTINGS', 'CRUD_OWN_LISTINGS', 'PUBLISH_OWN_LISTINGS', 'MANAGE_LISTER_AGENT_ACCOUNTS', 'APPROVE_AGENT_PROFILES', 'MODERATE_RENTERS', 'MANAGE_SUPER_ADMIN_ACCOUNTS', 'CHANGE_PLATFORM_SETTINGS', 'EDIT_ROLE_DEFINITIONS', 'VIEW_SYSTEM_LOGS', 'MAINTENANCE_BACKUPS');

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "readAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Property" ADD COLUMN     "featuredUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."AgentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "dailyFee" INTEGER,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "bio" TEXT,
    "status" "public"."AgentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ListingBoost" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "public"."BoostStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "ListingBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoleDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PermissionGrant" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permission" "public"."Permission" NOT NULL,
    "allow" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserRoleDefinition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRoleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "public"."Permission" NOT NULL,
    "allow" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "public"."AgentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleDefinition_name_key" ON "public"."RoleDefinition"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGrant_roleId_permission_key" ON "public"."PermissionGrant"("roleId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleDefinition_userId_roleId_key" ON "public"."UserRoleDefinition"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_permission_key" ON "public"."UserPermissionOverride"("userId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_propertyId_key" ON "public"."Favorite"("userId", "propertyId");

-- AddForeignKey
ALTER TABLE "public"."AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ListingBoost" ADD CONSTRAINT "ListingBoost_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PermissionGrant" ADD CONSTRAINT "PermissionGrant_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."RoleDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRoleDefinition" ADD CONSTRAINT "UserRoleDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRoleDefinition" ADD CONSTRAINT "UserRoleDefinition_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."RoleDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
