CREATE TABLE "Parcel" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "beneficiaryId" TEXT,
  "zoneId" TEXT,
  "gpsLat" DOUBLE PRECISION,
  "gpsLng" DOUBLE PRECISION,
  "locality" TEXT,
  "areaHectares" DOUBLE PRECISION,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Parcel_organizationId_idx" ON "Parcel"("organizationId");
