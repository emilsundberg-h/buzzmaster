-- AlterTable
ALTER TABLE "Round" ADD COLUMN "thumbGameActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Round" ADD COLUMN "thumbGameStarterId" TEXT;
ALTER TABLE "Round" ADD COLUMN "thumbGameResponders" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Round" ADD COLUMN "thumbGameUsedBy" TEXT NOT NULL DEFAULT '[]';
