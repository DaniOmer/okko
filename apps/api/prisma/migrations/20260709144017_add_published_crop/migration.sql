-- CreateTable
CREATE TABLE "PublishedCrop" (
    "cropId" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "publishedBy" TEXT NOT NULL,

    CONSTRAINT "PublishedCrop_pkey" PRIMARY KEY ("cropId")
);
