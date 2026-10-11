-- Gym prospects: how they found the gym is optional.
-- Additive only. Safe to run more than once.

ALTER TABLE "GymLead" ALTER COLUMN "source" DROP NOT NULL;
