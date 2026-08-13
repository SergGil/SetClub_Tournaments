-- CreateEnum
CREATE TYPE "MenuLayout" AS ENUM ('LIST', 'CARDS');

-- CreateTable
CREATE TABLE "menu_sections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "layout" "MenuLayout" NOT NULL DEFAULT 'LIST',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "description" TEXT,
    "photoKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_photoKey_key" ON "menu_items"("photoKey");

-- CreateIndex
CREATE INDEX "menu_items_sectionId_idx" ON "menu_items"("sectionId");

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "menu_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
