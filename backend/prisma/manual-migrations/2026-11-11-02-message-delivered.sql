-- Doble check gris del chat de soporte: el mensaje llegó a un dispositivo del otro lado.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
-- Lo que ya se leyó también se entregó
UPDATE "Message" SET "deliveredAt" = "createdAt" WHERE "isRead" = true AND "deliveredAt" IS NULL;
