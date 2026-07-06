-- CreateTable
CREATE TABLE "CropEvent" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "actor" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CropEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CropEvent_streamId_idx" ON "CropEvent"("streamId");

-- CreateIndex
CREATE UNIQUE INDEX "CropEvent_streamId_sequence_key" ON "CropEvent"("streamId", "sequence");
