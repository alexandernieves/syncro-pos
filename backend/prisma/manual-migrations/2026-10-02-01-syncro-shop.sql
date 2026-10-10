-- Syncro Shop: storefront tables and product fields (PLAN-SYNCRO-SHOP.md, phases 0-7).
-- Additive only: no table or column is dropped. Safe to run more than once.

-- Products: publication branch, specifications, landing page blocks
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "syncroShopBranchId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "specifications" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "landingBlocks" JSONB;
ALTER TABLE "Product" ALTER COLUMN "isPublishedOnSyncroShop" SET DEFAULT false;
ALTER TABLE "Product" ALTER COLUMN "isFeaturedOnSyncroShop" SET DEFAULT false;
DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_syncroShopBranchId_fkey"
    FOREIGN KEY ("syncroShopBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Already published products keep selling from their business's main branch
UPDATE "Product" p SET "syncroShopBranchId" = b."id"
FROM "Branch" b
WHERE p."isPublishedOnSyncroShop" = true
  AND p."syncroShopBranchId" IS NULL
  AND b."businessId" = p."businessId"
  AND b."id" = (
    SELECT b2."id" FROM "Branch" b2
    WHERE b2."businessId" = p."businessId"
    ORDER BY b2."isMain" DESC, b2."createdAt" ASC
    LIMIT 1
  );

ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "showOnSyncroShop" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Setting" ALTER COLUMN "isSyncroVendor" SET DEFAULT false;

-- Sales: channel to tell POS sales from online orders
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'POS';

-- Product gallery (max 5, enforced by the API)
CREATE TABLE IF NOT EXISTS "ProductImage" (
  "id" TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProductImage_productId_idx" ON "ProductImage"("productId");

-- Public store profile (1:1 with Business)
CREATE TABLE IF NOT EXISTS "StoreProfile" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL UNIQUE REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "slug" TEXT NOT NULL UNIQUE,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Store customers (separate from POS staff users)
CREATE TABLE IF NOT EXISTS "ShopCustomer" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Online orders (one order = one business)
CREATE TABLE IF NOT EXISTS "ShopOrder" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "shopCustomerId" TEXT REFERENCES "ShopCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "clientId" TEXT REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE,
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
  "saleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "statusHistory" JSONB,
  "rejectionReason" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ShopOrder_businessId_status_idx" ON "ShopOrder"("businessId", "status");
CREATE INDEX IF NOT EXISTS "ShopOrder_customerPhone_idx" ON "ShopOrder"("customerPhone");

CREATE TABLE IF NOT EXISTS "ShopOrderItem" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "productId" TEXT REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "variantId" TEXT REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "branchId" TEXT REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "productName" TEXT NOT NULL,
  "variantName" TEXT,
  "image" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "subtotal" DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS "ShopOrderItem_orderId_idx" ON "ShopOrderItem"("orderId");

-- Product reviews (registered customers only, one per customer and product)
CREATE TABLE IF NOT EXISTS "ProductReview" (
  "id" TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "customerId" TEXT NOT NULL REFERENCES "ShopCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" TEXT,
  "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
  "isHidden" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("productId", "customerId")
);
CREATE INDEX IF NOT EXISTS "ProductReview_productId_idx" ON "ProductReview"("productId");
