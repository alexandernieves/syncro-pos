-- Bolsa automática en el punto de venta (Configuración → Punto de venta).
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "autoBag" JSONB;
