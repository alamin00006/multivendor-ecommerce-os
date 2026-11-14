-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "seoContent" TEXT;

-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "deliveryInsideDhaka" TEXT NOT NULL DEFAULT '1–2 days',
ADD COLUMN     "deliveryOutsideDhaka" TEXT NOT NULL DEFAULT '3–5 days',
ADD COLUMN     "returnDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "returnPolicy" TEXT NOT NULL DEFAULT 'Unused items in original packaging can be returned within the return window.',
ADD COLUMN     "shippingInsideDhaka" INTEGER NOT NULL DEFAULT 6000,
ADD COLUMN     "shippingOutsideDhaka" INTEGER NOT NULL DEFAULT 12000,
ADD COLUMN     "socialLinks" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "storeAddress" TEXT NOT NULL DEFAULT 'House 1, Road 1, Gulshan 1, Dhaka 1212, Bangladesh',
ADD COLUMN     "supportEmail" TEXT NOT NULL DEFAULT 'support@marketbd.example',
ADD COLUMN     "supportHours" TEXT NOT NULL DEFAULT '9 am – 9 pm (Everyday)',
ADD COLUMN     "supportPhone" TEXT NOT NULL DEFAULT '+8809600000000';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "specifications" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "warranty" TEXT;

-- CreateTable
CREATE TABLE "ProductQuestion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductQuestion_productId_isVisible_createdAt_idx" ON "ProductQuestion"("productId", "isVisible", "createdAt");

-- CreateIndex
CREATE INDEX "ProductQuestion_answeredAt_idx" ON "ProductQuestion"("answeredAt");

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
