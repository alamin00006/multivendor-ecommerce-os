-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "voucherCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
