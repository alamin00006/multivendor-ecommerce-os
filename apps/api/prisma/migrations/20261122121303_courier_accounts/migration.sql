-- AlterEnum
ALTER TYPE "CourierProvider" ADD VALUE 'STEADFAST';

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "trackingCode" TEXT,
ALTER COLUMN "storeExternalId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CourierAccount" (
    "provider" "CourierProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "credentials" TEXT,
    "webhookSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierAccount_pkey" PRIMARY KEY ("provider")
);
