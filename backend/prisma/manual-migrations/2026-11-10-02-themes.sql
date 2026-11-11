-- Temas guardados por negocio, por sucursal y por usuario de caja (solo punto de venta).
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "themes" JSONB;
