-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "orderEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "orderSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderSmsEvents" TEXT[] DEFAULT ARRAY['PLACED', 'SHIPPED', 'DELIVERED']::TEXT[];
