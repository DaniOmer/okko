-- Ajout des colonnes (nullable d'abord pour permettre le backfill)
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Backfill depuis "name" : firstName = avant le 1er espace, lastName = le reste
UPDATE "User" SET
  "firstName" = split_part("name", ' ', 1),
  "lastName"  = CASE WHEN position(' ' in "name") > 0
                     THEN trim(substring("name" from position(' ' in "name") + 1))
                     ELSE '' END;

-- Contraintes NOT NULL + suppression de l'ancienne colonne
ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "name";
