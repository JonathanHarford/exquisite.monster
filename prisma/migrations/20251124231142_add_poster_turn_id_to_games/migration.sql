-- AlterTable
ALTER TABLE "games" ADD COLUMN     "posterTurnId" TEXT;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_posterTurnId_fkey" FOREIGN KEY ("posterTurnId") REFERENCES "turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
