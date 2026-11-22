-- Free-delivery vouchers may use 0 for "the whole delivery fee"; every other voucher needs a positive value.
ALTER TABLE "Coupon" DROP CONSTRAINT "Coupon_value_positive";
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_value_valid" CHECK ("value" > 0 OR ("type" = 'FREE_SHIPPING' AND "value" = 0));

-- Scope consistency: store vouchers belong to a shop, payment vouchers name a method.
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_store_has_seller" CHECK ("scope" <> 'STORE' OR "sellerId" IS NOT NULL);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_payment_has_method" CHECK ("scope" <> 'PAYMENT' OR "paymentMethod" IS NOT NULL);
