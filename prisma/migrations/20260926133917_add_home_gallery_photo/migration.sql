-- CreateTable
CREATE TABLE "home_gallery_photos" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_gallery_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_gallery_photos_key_key" ON "home_gallery_photos"("key");
