-- CreateEnum
CREATE TYPE "CourierProvider" AS ENUM ('PATHAO');

-- CreateTable
CREATE TABLE "CourierStore" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "provider" "CourierProvider" NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "cityId" INTEGER NOT NULL,
    "zoneId" INTEGER NOT NULL,
    "areaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "provider" "CourierProvider" NOT NULL,
    "consignmentId" TEXT NOT NULL,
    "merchantOrderId" TEXT NOT NULL,
    "storeExternalId" TEXT NOT NULL,
    "courierStatus" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "codAmount" INTEGER NOT NULL,
    "deliveryFee" INTEGER,
    "collectedAmount" INTEGER,
    "courierUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourierStore_sellerId_provider_key" ON "CourierStore"("sellerId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_merchantOrderId_key" ON "Shipment"("merchantOrderId");

-- CreateIndex
CREATE INDEX "Shipment_subOrderId_idx" ON "Shipment"("subOrderId");

-- CreateIndex
CREATE INDEX "Shipment_active_updatedAt_idx" ON "Shipment"("active", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_provider_consignmentId_key" ON "Shipment"("provider", "consignmentId");

-- AddForeignKey
ALTER TABLE "CourierStore" ADD CONSTRAINT "CourierStore_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
