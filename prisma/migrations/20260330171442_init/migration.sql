-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'PRO');

-- CreateEnum
CREATE TYPE "PurchaseChannel" AS ENUM ('SHOPIFY', 'AMAZON', 'RETAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('DEFECTIVE', 'DAMAGED', 'MISSING_PARTS', 'OTHER');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EmailTemplateType" AS ENUM ('REGISTRATION_CONFIRM', 'WARRANTY_EXPIRY', 'CLAIM_RECEIVED', 'CLAIM_UPDATE');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "email" TEXT,
    "plan" "PlanType" NOT NULL DEFAULT 'FREE',
    "brandColor" TEXT NOT NULL DEFAULT '#2563eb',
    "brandLogo" TEXT,
    "dataProcessingConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 12,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requireSerialNumber" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialNumber" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerialNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "purchaseChannel" "PurchaseChannel" NOT NULL DEFAULT 'SHOPIFY',
    "proofOfPurchaseUrl" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "warrantyExpiresAt" TIMESTAMP(3),
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentTimestamp" TIMESTAMP(3),
    "expiryNotificationSent" BOOLEAN NOT NULL DEFAULT false,
    "shopifyOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "issueDescription" TEXT NOT NULL,
    "issueType" "IssueType" NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'OPEN',
    "merchantNotes" TEXT,
    "attachmentUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" "EmailTemplateType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "status" "DeletionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_domain_key" ON "Shop"("domain");

-- CreateIndex
CREATE INDEX "Product_shopId_idx" ON "Product"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopId_shopifyProductId_key" ON "Product"("shopId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "SerialNumber_productId_idx" ON "SerialNumber"("productId");

-- CreateIndex
CREATE INDEX "SerialNumber_shopId_serialNumber_idx" ON "SerialNumber"("shopId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SerialNumber_shopId_serialNumber_key" ON "SerialNumber"("shopId", "serialNumber");

-- CreateIndex
CREATE INDEX "Registration_shopId_idx" ON "Registration"("shopId");

-- CreateIndex
CREATE INDEX "Registration_customerEmail_idx" ON "Registration"("customerEmail");

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "Registration"("status");

-- CreateIndex
CREATE INDEX "Registration_warrantyExpiresAt_idx" ON "Registration"("warrantyExpiresAt");

-- CreateIndex
CREATE INDEX "Registration_shopId_status_idx" ON "Registration"("shopId", "status");

-- CreateIndex
CREATE INDEX "Claim_registrationId_idx" ON "Claim"("registrationId");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_shopId_type_key" ON "EmailTemplate"("shopId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_shopId_month_key" ON "RateLimit"("shopId", "month");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
