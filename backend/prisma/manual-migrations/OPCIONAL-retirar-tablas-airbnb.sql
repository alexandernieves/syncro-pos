-- ⚠️ OPCIONAL Y DESTRUCTIVO. NO se aplica en el despliegue normal.
-- Retira las tablas del clon de Airbnb que syncro.shop ya no usa.
-- Ejecutar SOLO con aprobación explícita, con respaldo de la base hecho
-- y después de revisar que no tengan datos que se quieran conservar:
--   SELECT count(*) FROM "Listing";      -- copias de productos de la plantilla vieja
--   SELECT count(*) FROM "Reservation";  -- reservas de la plantilla vieja

BEGIN;
DROP TABLE IF EXISTS "Reservation";
DROP TABLE IF EXISTS "Listing";
COMMIT;
