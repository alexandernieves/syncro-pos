-- Cantidades decimales (2026-09-15)
--
-- Stock y cantidades pasan de entero a doble precision. Sin esto el sistema
-- no puede vender 0,85 kg de queso ni 3,5 m de cable: la interfaz ya pedia
-- decimales pero la columna los truncaba.
--
-- Es un ensanchamiento de tipo. Todo entero existente cabe exacto en un
-- double, asi que no se pierde ningun dato. Postgres reescribe la tabla.
--
-- Reward.stock queda en entero a proposito: los premios de fidelidad son
-- objetos discretos, no mercancia que se pese.
--
-- Este proyecto no usa migraciones de Prisma (usa `db push`). El archivo
-- queda como registro de un cambio aplicado sobre la base de produccion.

-- AlterTable
ALTER TABLE "Inventory" ALTER COLUMN "quantity" SET DEFAULT 0,
ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "InventoryMovement" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "InventoryTransferItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "stock" SET DEFAULT 0,
ALTER COLUMN "stock" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "minStock" SET DEFAULT 5,
ALTER COLUMN "minStock" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ProductWaitlist" ALTER COLUMN "stock" SET DEFAULT 0,
ALTER COLUMN "stock" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "SaleItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "SaleReturnItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "SupplierReturn" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;
