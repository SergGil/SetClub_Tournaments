-- CreateTable
CREATE TABLE "padel_photos" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "padel_photos_key_key" ON "padel_photos"("key");

-- CreateIndex
CREATE INDEX "padel_photos_tournamentId_idx" ON "padel_photos"("tournamentId");

-- AddForeignKey
ALTER TABLE "padel_photos" ADD CONSTRAINT "padel_photos_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "padel_tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_photos" ADD CONSTRAINT "padel_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
