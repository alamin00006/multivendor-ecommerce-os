-- CreateEnum
CREATE TYPE "Fulfillment" AS ENUM ('PLATFORM', 'SELLER');

-- CreateEnum
CREATE TYPE "OwnDeliveryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "ownDeliveryDueLimit" INTEGER NOT NULL DEFAULT 500000;

-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "ownDelivery" JSONB,
ADD COLUMN     "ownDeliveryNote" TEXT,
ADD COLUMN     "ownDeliveryStatus" "OwnDeliveryStatus",
ADD COLUMN     "ownDeliveryUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SubOrder" ADD COLUMN     "courierName" TEXT,
ADD COLUMN     "disputeNote" TEXT,
ADD COLUMN     "disputeResolution" TEXT,
ADD COLUMN     "disputeResolvedAt" TIMESTAMP(3),
ADD COLUMN     "disputedAt" TIMESTAMP(3),
ADD COLUMN     "fulfillment" "Fulfillment" NOT NULL DEFAULT 'PLATFORM',
ADD COLUMN     "sellerCollectsCash" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SellerAdjustment" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "reference" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellerAdjustment_sellerId_createdAt_idx" ON "SellerAdjustment"("sellerId", "createdAt");

-- AddForeignKey
ALTER TABLE "SellerAdjustment" ADD CONSTRAINT "SellerAdjustment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
