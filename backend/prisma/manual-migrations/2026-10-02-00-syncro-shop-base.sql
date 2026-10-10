-- Syncro Shop base: columns and tables the later Syncro Shop files assume exist.
-- On a database that already has them (created with `db push`) every statement is a no-op.
-- Additive only. Safe to run more than once. Run before 2026-10-02-01-syncro-shop.sql.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isPublishedOnSyncroShop" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isFeaturedOnSyncroShop" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'POS';
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "isSyncroVendor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "syncroShopLocation" TEXT DEFAULT '';
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "syncroShopSectionTitle" TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS "ProductImage" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StoreProfile" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT,
  "logo" TEXT,
  "banner" TEXT,
  "description" TEXT,
  "address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "phone" TEXT,
  "whatsapp" TEXT,
  "email" TEXT,
  "socials" JSONB,
  "schedule" JSONB,
  "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
  "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
  "deliveryCostMode" TEXT NOT NULL DEFAULT 'FIXED',
  "deliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "freeDeliveryFrom" DOUBLE PRECISION,
  "deliveryNotes" TEXT,
  "minOrderAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "showBolivares" BOOLEAN NOT NULL DEFAULT true,
  "returnPolicy" TEXT,
  "deliveryTime" TEXT,
  "checkoutForm" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShopCustomer" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShopOrder" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "shopCustomerId" TEXT,
  "clientId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerEmail" TEXT,
  "address" TEXT,
  "city" TEXT,
  "reference" TEXT,
  "notes" TEXT,
  "deliveryMethod" TEXT NOT NULL DEFAULT 'PICKUP',
  "customFields" JSONB,
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "saleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "statusHistory" JSONB,
  "rejectionReason" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShopOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT,
  "variantId" TEXT,
  "branchId" TEXT,
  "productName" TEXT NOT NULL,
  "variantName" TEXT,
  "image" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "subtotal" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "ShopOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductReview" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
  "isHidden" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "StoreProfile_businessId_key" ON "StoreProfile"("businessId");
CREATE UNIQUE INDEX IF NOT EXISTS "StoreProfile_slug_key" ON "StoreProfile"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopCustomer_email_key" ON "ShopCustomer"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopOrder_code_key" ON "ShopOrder"("code");
CREATE INDEX IF NOT EXISTS "ShopOrder_businessId_status_idx" ON "ShopOrder"("businessId", "status");
CREATE INDEX IF NOT EXISTS "ShopOrder_customerPhone_idx" ON "ShopOrder"("customerPhone");
CREATE INDEX IF NOT EXISTS "ShopOrderItem_orderId_idx" ON "ShopOrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "ProductReview_productId_idx" ON "ProductReview"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductReview_productId_customerId_key" ON "ProductReview"("productId", "customerId");

DO $$ BEGIN
  ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StoreProfile" ADD CONSTRAINT "StoreProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_shopCustomerId_fkey" FOREIGN KEY ("shopCustomerId") REFERENCES "ShopCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ShopCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
