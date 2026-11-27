-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "accountSellerId" TEXT;

-- CreateTable
CREATE TABLE "SellerCourierAccount" (
    "sellerId" TEXT NOT NULL,
    "provider" "CourierProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "credentials" TEXT,
    "webhookSecret" TEXT NOT NULL,
    "storeExternalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerCourierAccount_pkey" PRIMARY KEY ("sellerId","provider")
);

-- AddForeignKey
ALTER TABLE "SellerCourierAccount" ADD CONSTRAINT "SellerCourierAccount_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
