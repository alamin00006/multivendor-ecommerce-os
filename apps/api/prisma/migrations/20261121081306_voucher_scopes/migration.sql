-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('PLATFORM', 'STORE', 'PAYMENT');

-- AlterEnum
ALTER TYPE "CouponType" ADD VALUE 'FREE_SHIPPING';

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "scope" "CouponScope" NOT NULL DEFAULT 'PLATFORM',
ADD COLUMN     "sellerId" TEXT;

-- CreateTable
CREATE TABLE "CouponCollection" (
    "userId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponCollection_pkey" PRIMARY KEY ("userId","couponId")
);

-- CreateIndex
CREATE INDEX "CouponCollection_couponId_idx" ON "CouponCollection"("couponId");

-- CreateIndex
CREATE INDEX "Coupon_isActive_endsAt_idx" ON "Coupon"("isActive", "endsAt");

-- CreateIndex
CREATE INDEX "Coupon_sellerId_idx" ON "Coupon"("sellerId");

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCollection" ADD CONSTRAINT "CouponCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCollection" ADD CONSTRAINT "CouponCollection_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
