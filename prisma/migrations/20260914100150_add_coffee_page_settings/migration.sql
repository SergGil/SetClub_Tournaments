-- CreateTable
CREATE TABLE "coffee_page_settings" (
    "id" TEXT NOT NULL,
    "heroTitle" TEXT NOT NULL,
    "heroSubtitle" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coffee_page_settings_pkey" PRIMARY KEY ("id")
);
