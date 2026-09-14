-- CreateTable
CREATE TABLE "home_panel_settings" (
    "key" "AdminDomain" NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_panel_settings_pkey" PRIMARY KEY ("key")
);
