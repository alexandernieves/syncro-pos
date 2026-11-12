-- Órdenes de compra: unidades de medida (cajas, bultos…), recepción parcial y estado "Recibida parcial".
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'UNIDAD';
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "unitFactor" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "receivedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
-- Las órdenes ya recibidas se recibieron completas
UPDATE "PurchaseOrderItem" i SET "receivedQuantity" = i.quantity
  FROM "PurchaseOrder" o
  WHERE o.id = i."purchaseOrderId" AND o.status = 'RECEIVED' AND i."receivedQuantity" = 0;
