-- CreateEnum
CREATE TYPE "AdminDomain" AS ENUM ('TENNIS', 'COFFEE', 'PADEL');

-- CreateTable
CREATE TABLE "user_admin_domains" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" "AdminDomain" NOT NULL,

    CONSTRAINT "user_admin_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_admin_domains_userId_domain_key" ON "user_admin_domains"("userId", "domain");

-- AddForeignKey
ALTER TABLE "user_admin_domains" ADD CONSTRAINT "user_admin_domains_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
