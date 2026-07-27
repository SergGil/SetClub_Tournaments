-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "gender" "Gender";
