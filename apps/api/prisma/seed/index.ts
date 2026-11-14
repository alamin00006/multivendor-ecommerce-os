import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { AREAS, DISTRICTS, DIVISIONS, toPoisha } from '@marketbd/shared';
import { PrismaClient, type Prisma } from '../../src/generated/prisma/client.js';
import { BRANDS, CATEGORIES, type ProductTemplate, type SellerKey } from './catalog-data.js';
import { seedContent } from './content.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

/** Deterministic PRNG so every seed run produces the same demo data. */
const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = mulberry32(20260109);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const slugify = (input: string) =>
  input
    .toLowerCase()
    .replace(/["'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const img = (seed: string, w: number, h: number) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const roundPrice = (taka: number) => (taka >= 1000 ? Math.round(taka / 10) * 10 - 1 : Math.round(taka));

const DAY = 24 * 60 * 60 * 1000;

async function seedGeo() {
  for (const d of DIVISIONS) {
    await prisma.division.upsert({ where: { id: d.id }, update: { name: d.name, nameBn: d.nameBn }, create: d });
  }
  for (const d of DISTRICTS) {
    await prisma.district.upsert({
      where: { id: d.id },
      update: { name: d.name, nameBn: d.nameBn, divisionId: d.divisionId },
      create: d,
    });
  }
  for (const a of AREAS) {
    await prisma.area.upsert({
      where: { districtId_name: { districtId: a.districtId, name: a.name } },
      update: { nameBn: a.nameBn, isInsideDhaka: a.isInsideDhaka },
      create: a,
    });
  }
  console.log(`✓ geo: ${DIVISIONS.length} divisions, ${DISTRICTS.length} districts, ${AREAS.length} areas`);
}

async function seedPlatformSettings() {
  const existing = await prisma.platformSetting.findUnique({ where: { id: 1 } });
  if (existing) {
    console.log(`✓ platform settings kept (multiVendorEnabled=${existing.multiVendorEnabled})`);
    return;
  }
  const multiVendorEnabled = (process.env.MULTI_VENDOR_ENABLED ?? 'true').toLowerCase() === 'true';
  await prisma.platformSetting.create({ data: { id: 1, multiVendorEnabled } });
  console.log(`✓ platform settings created (multiVendorEnabled=${multiVendorEnabled})`);
}

async function seedAdminAndHouseStore() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@marketbd.example';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'MarketBD Admin',
      role: 'ADMIN',
      passwordHash: await argon2.hash(password),
      emailVerifiedAt: new Date(),
    },
  });
  const house = await prisma.sellerProfile.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      shopName: 'MarketBD Official',
      slug: 'marketbd-official',
      description: 'Products sold and shipped directly by MarketBD.',
      status: 'APPROVED',
      isHouseStore: true,
      commissionRate: 0,
      approvedAt: new Date(),
      logoUrl: img('marketbd-official-logo', 256, 256),
      bannerUrl: img('marketbd-official-banner', 1200, 300),
    },
  });
  console.log(`✓ admin ${email} + house store`);
  return house;
}

const SELLERS: ReadonlyArray<{
  key: SellerKey;
  email: string;
  name: string;
  shopName: string;
  phone: string;
  description: string;
  commission: number;
}> = [
  {
    key: 'gadget',
    email: 'gadgetghor@marketbd.example',
    name: 'Rafiq Hasan',
    shopName: 'Gadget Ghor',
    phone: '+8801711000001',
    description: 'Phones, laptops, accessories and appliances with official warranty.',
    commission: 8,
  },
  {
    key: 'deshi',
    email: 'deshibazar@marketbd.example',
    name: 'Nusrat Jahan',
    shopName: 'Deshi Bazar',
    phone: '+8801811000002',
    description: 'Handloom fashion, home décor and lifestyle from local makers.',
    commission: 12,
  },
  {
    key: 'fresh',
    email: 'freshbasket@marketbd.example',
    name: 'Tanvir Ahmed',
    shopName: 'Fresh Basket',
    phone: '+8801911000003',
    description: 'Daily groceries, beauty, baby and pet essentials.',
    commission: 10,
  },
];

async function seedSellers() {
  const passwordHash = await argon2.hash('Seller@12345');
  const map = new Map<SellerKey, string>();
  for (const s of SELLERS) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        phone: s.phone,
        name: s.name,
        role: 'SELLER',
        passwordHash,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
      },
    });
    const slug = slugify(s.shopName);
    const profile = await prisma.sellerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        shopName: s.shopName,
        slug,
        description: s.description,
        phone: s.phone,
        pickupAddress: 'Dhaka, Bangladesh',
        status: 'APPROVED',
        commissionRate: s.commission,
        approvedAt: new Date(),
        logoUrl: img(`${slug}-logo`, 256, 256),
        bannerUrl: img(`${slug}-banner`, 1200, 300),
      },
    });
    map.set(s.key, profile.id);
  }
  console.log(`✓ ${SELLERS.length} sellers (password Seller@12345)`);
  return map;
}

async function seedCustomers() {
  const passwordHash = await argon2.hash('Customer@12345');
  const customers = [
    { email: 'customer@marketbd.example', phone: '+8801700000001', name: 'Arif Rahman' },
    { email: 'sadia@marketbd.example', phone: '+8801700000002', name: 'Sadia Islam' },
    { email: 'mehedi@marketbd.example', phone: '+8801700000003', name: 'Mehedi Hasan' },
    { email: 'farzana@marketbd.example', phone: '+8801700000004', name: 'Farzana Akter' },
  ];
  const ids: string[] = [];
  for (const c of customers) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { ...c, role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date(), phoneVerifiedAt: new Date() },
    });
    ids.push(user.id);
  }
  const first = ids[0];
  if (first && (await prisma.address.count({ where: { userId: first } })) === 0) {
    const dhanmondi = await prisma.area.findUniqueOrThrow({
      where: { districtId_name: { districtId: 18, name: 'Dhanmondi' } },
    });
    await prisma.address.create({
      data: {
        userId: first,
        label: 'HOME',
        fullName: 'Arif Rahman',
        phone: '+8801700000001',
        divisionId: 3,
        districtId: 18,
        areaId: dhanmondi.id,
        addressLine: 'House 12, Road 7A',
        landmark: 'Near Rabindra Sarobar',
        isDefault: true,
      },
    });
  }
  console.log(`✓ ${customers.length} customers (password Customer@12345)`);
  return ids;
}

/** Cartesian product of option dimensions → list of attribute records. */
const expandOptions = (options: Record<string, string[]>): Array<Record<string, string>> => {
  const entries = Object.entries(options);
  if (entries.length === 0) return [{}];
  return entries.reduce<Array<Record<string, string>>>(
    (acc, [key, values]) => acc.flatMap((combo) => values.map((v) => ({ ...combo, [key]: v }))),
    [{}],
  );
};

const buildVariants = (
  template: ProductTemplate,
  skuBase: string,
): Prisma.ProductVariantCreateWithoutProductInput[] => {
  const [firstKey, firstValues] = Object.entries(template.options)[0] ?? [undefined, []];
  return expandOptions(template.options).map((attributes, idx) => {
    const tier = firstKey ? firstValues.indexOf(attributes[firstKey] ?? '') : 0;
    const priceTaka = roundPrice(template.price + Math.max(0, tier) * (template.tierStep ?? 0));
    const compare = template.markup > 0 ? roundPrice(priceTaka * (1 + template.markup / 100)) : null;
    const stock = rand() < 0.08 ? randInt(1, 4) : randInt(8, 120);
    return {
      sku: `${skuBase}-${String(idx + 1).padStart(2, '0')}`,
      attributes,
      price: toPoisha(priceTaka),
      compareAtPrice: compare ? toPoisha(compare) : null,
      stock,
    };
  });
};

async function seedCatalog(sellerIds: Map<SellerKey, string>, houseStoreId: string, customerIds: string[]) {
  if ((await prisma.product.count()) > 0) {
    console.log('• catalog already present — skipping products, campaigns and merchandising');
    return false;
  }

  const brandIds = new Map<string, string>();
  for (const b of BRANDS) {
    const brand = await prisma.brand.create({ data: { ...b, logoUrl: img(`brand-${b.slug}`, 200, 200) } });
    brandIds.set(b.name, brand.id);
  }

  let productIndex = 0;
  const productIds: string[] = [];
  for (const [catIdx, cat] of CATEGORIES.entries()) {
    const parent = await prisma.category.create({
      data: {
        name: cat.name,
        nameBn: cat.nameBn,
        slug: cat.slug,
        sortOrder: catIdx,
        iconUrl: img(`cat-${cat.slug}`, 160, 160),
        imageUrl: img(`cat-${cat.slug}-cover`, 600, 400),
      },
    });
    for (const [subIdx, sub] of cat.children.entries()) {
      const child = await prisma.category.create({
        data: {
          name: sub.name,
          nameBn: sub.nameBn,
          slug: sub.slug,
          parentId: parent.id,
          sortOrder: subIdx,
          iconUrl: img(`cat-${sub.slug}`, 160, 160),
          imageUrl: img(`cat-${sub.slug}-cover`, 600, 400),
        },
      });
      for (const template of sub.products) {
        productIndex += 1;
        const slug = slugify(template.title);
        // Every third product belongs to the house store so single-vendor mode has a full catalog.
        const sellerId = productIndex % 3 === 0 ? houseStoreId : (sellerIds.get(cat.seller) ?? houseStoreId);
        const variants = buildVariants(template, `MBD-${String(productIndex).padStart(3, '0')}`);
        const minPrice = Math.min(...variants.map((v) => v.price));
        const product = await prisma.product.create({
          data: {
            title: template.title,
            titleBn: template.titleBn,
            slug,
            description: `${template.description}\n\nSold with a 7-day easy return policy. Cash on Delivery available across Bangladesh.`,
            descriptionBn: `${template.titleBn} — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি এবং ৭ দিনের সহজ রিটার্ন সুবিধা।`,
            status: 'ACTIVE',
            minPrice,
            soldCount: randInt(0, 2500),
            seller: { connect: { id: sellerId } },
            category: { connect: { id: child.id } },
            brand: { connect: { id: brandIds.get(template.brand) ?? '' } },
            variants: { create: variants },
            images: {
              create: [0, 1, 2, 3].map((n) => ({
                url: img(`${slug}-${n}`, 800, 800),
                alt: template.title,
                sortOrder: n,
              })),
            },
          },
        });
        productIds.push(product.id);
      }
    }
  }
  console.log(
    `✓ ${CATEGORIES.length} categories (+${CATEGORIES.length * 3} sub-categories), ${BRANDS.length} brands, ${productIds.length} products`,
  );

  await seedReviews(productIds, customerIds);
  await seedMerchandising(productIds);
  return true;
}

const REVIEW_COMMENTS = [
  'Product matches the description. Delivery was quick.',
  'Good quality for the price. Packaging was secure.',
  'Very happy with this purchase, will order again.',
  'Decent product but delivery took a little longer than expected.',
  'Exactly as shown in the pictures. Recommended!',
  'অসাধারণ পণ্য, দ্রুত ডেলিভারি পেয়েছি।',
  'দামের তুলনায় মান খুব ভালো।',
];

async function seedReviews(productIds: string[], customerIds: string[]) {
  let count = 0;
  for (const productId of productIds) {
    if (rand() < 0.35) continue;
    const reviewers = customerIds.filter(() => rand() < 0.6);
    for (const userId of reviewers) {
      const rating = rand() < 0.75 ? randInt(4, 5) : randInt(2, 3);
      await prisma.review.create({
        data: { productId, userId, rating, comment: REVIEW_COMMENTS[randInt(0, REVIEW_COMMENTS.length - 1)] ?? null },
      });
      count += 1;
    }
    const agg = await prisma.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: true });
    await prisma.product.update({
      where: { id: productId },
      data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
    });
  }
  // Seller rating = average of visible reviews across the seller's products.
  const sellers = await prisma.sellerProfile.findMany({ select: { id: true } });
  for (const seller of sellers) {
    const agg = await prisma.review.aggregate({ where: { isVisible: true, product: { sellerId: seller.id } }, _avg: { rating: true } });
    await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10 },
    });
  }
  console.log(`✓ ${count} reviews`);
}

async function seedMerchandising(productIds: string[]) {
  const now = Date.now();

  const megaSale = await prisma.campaign.create({
    data: {
      slug: 'winter-mega-sale',
      title: 'Winter Mega Sale',
      titleBn: 'শীতের মেগা সেল',
      description: 'Up to 60% off on fashion, home and electronics. Free delivery on selected items.',
      bannerUrl: img('campaign-winter-mega', 1600, 480),
      mobileBannerUrl: img('campaign-winter-mega-m', 800, 400),
      themeColor: '#08755a',
      type: 'MEGA_SALE',
      startAt: new Date(now - DAY),
      endAt: new Date(now + 21 * DAY),
      sortOrder: 0,
    },
  });
  const gadgetFest = await prisma.campaign.create({
    data: {
      slug: 'gadget-fest',
      title: 'Gadget Fest',
      titleBn: 'গ্যাজেট ফেস্ট',
      description: 'The best deals on phones, audio and smart devices.',
      bannerUrl: img('campaign-gadget-fest', 1600, 480),
      mobileBannerUrl: img('campaign-gadget-fest-m', 800, 400),
      themeColor: '#e23d18',
      type: 'CATEGORY_SALE',
      startAt: new Date(now - DAY),
      endAt: new Date(now + 14 * DAY),
      sortOrder: 1,
    },
  });

  const shuffled = [...productIds].sort(() => rand() - 0.5);
  await prisma.campaignProduct.createMany({
    data: shuffled.slice(0, 30).map((productId, i) => ({ campaignId: megaSale.id, productId, sortOrder: i })),
  });
  const gadgetProducts = await prisma.product.findMany({
    where: { category: { parent: { slug: { in: ['electronic-devices', 'electronic-accessories'] } } } },
    select: { id: true },
  });
  await prisma.campaignProduct.createMany({
    data: gadgetProducts.map((p, i) => ({ campaignId: gadgetFest.id, productId: p.id, sortOrder: i })),
  });

  const flashSale = await prisma.flashSale.create({
    data: {
      title: 'Flash Sale',
      titleBn: 'ফ্ল্যাশ সেল',
      startAt: new Date(now - 60 * 60 * 1000),
      endAt: new Date(now + 7 * DAY),
    },
  });
  const flashVariants = await prisma.productVariant.findMany({
    where: { productId: { in: shuffled.slice(30, 44) }, stock: { gte: 10 } },
    distinct: ['productId'],
    take: 12,
  });
  await prisma.flashSaleItem.createMany({
    data: flashVariants.map((v, i) => {
      const stockLimit = randInt(20, 80);
      return {
        flashSaleId: flashSale.id,
        variantId: v.id,
        specialPrice: Math.round((v.price * (100 - randInt(20, 45))) / 100 / 100) * 100,
        stockLimit,
        soldCount: randInt(0, Math.floor(stockLimit * 0.8)),
        sortOrder: i,
      };
    }),
  });

  await prisma.banner.createMany({
    data: [
      {
        title: 'Winter Mega Sale',
        imageUrl: img('banner-hero-1', 1600, 480),
        mobileImageUrl: img('banner-hero-1m', 800, 400),
        linkType: 'CAMPAIGN',
        linkValue: 'winter-mega-sale',
        sortOrder: 0,
      },
      {
        title: 'Gadget Fest',
        imageUrl: img('banner-hero-2', 1600, 480),
        mobileImageUrl: img('banner-hero-2m', 800, 400),
        linkType: 'CAMPAIGN',
        linkValue: 'gadget-fest',
        sortOrder: 1,
      },
      {
        title: 'Fresh groceries delivered',
        imageUrl: img('banner-hero-3', 1600, 480),
        mobileImageUrl: img('banner-hero-3m', 800, 400),
        linkType: 'CATEGORY',
        linkValue: 'groceries',
        sortOrder: 2,
      },
      {
        title: 'Festive fashion',
        imageUrl: img('banner-hero-4', 1600, 480),
        mobileImageUrl: img('banner-hero-4m', 800, 400),
        linkType: 'CATEGORY',
        linkValue: 'womens-fashion',
        sortOrder: 3,
      },
      {
        title: 'Smartphones under ৳30,000',
        imageUrl: img('banner-mid-1', 1200, 300),
        placement: 'HOME_MID',
        linkType: 'CATEGORY',
        linkValue: 'smartphones',
        sortOrder: 0,
      },
      {
        title: 'Home makeover',
        imageUrl: img('banner-mid-2', 1200, 300),
        placement: 'HOME_MID',
        linkType: 'CATEGORY',
        linkValue: 'home-lifestyle',
        sortOrder: 1,
      },
    ],
  });

  await prisma.quickLink.createMany({
    data: [
      {
        label: 'Flash Sale',
        labelBn: 'ফ্ল্যাশ সেল',
        iconUrl: img('ql-flash', 96, 96),
        linkType: 'SEARCH',
        linkValue: 'flash-sale',
        sortOrder: 0,
      },
      {
        label: 'Mega Sale',
        labelBn: 'মেগা সেল',
        iconUrl: img('ql-mega', 96, 96),
        linkType: 'CAMPAIGN',
        linkValue: 'winter-mega-sale',
        sortOrder: 1,
      },
      {
        label: 'Gadget Fest',
        labelBn: 'গ্যাজেট ফেস্ট',
        iconUrl: img('ql-gadget', 96, 96),
        linkType: 'CAMPAIGN',
        linkValue: 'gadget-fest',
        sortOrder: 2,
      },
      {
        label: 'Groceries',
        labelBn: 'মুদি বাজার',
        iconUrl: img('ql-grocery', 96, 96),
        linkType: 'CATEGORY',
        linkValue: 'groceries',
        sortOrder: 3,
      },
      {
        label: 'Fashion',
        labelBn: 'ফ্যাশন',
        iconUrl: img('ql-fashion', 96, 96),
        linkType: 'CATEGORY',
        linkValue: 'womens-fashion',
        sortOrder: 4,
      },
      {
        label: 'Beauty',
        labelBn: 'সৌন্দর্য',
        iconUrl: img('ql-beauty', 96, 96),
        linkType: 'CATEGORY',
        linkValue: 'health-beauty',
        sortOrder: 5,
      },
      {
        label: 'Phones',
        labelBn: 'ফোন',
        iconUrl: img('ql-phones', 96, 96),
        linkType: 'CATEGORY',
        linkValue: 'smartphones',
        sortOrder: 6,
      },
      {
        label: 'Pet Care',
        labelBn: 'পেট কেয়ার',
        iconUrl: img('ql-pets', 96, 96),
        linkType: 'CATEGORY',
        linkValue: 'pet-supplies',
        sortOrder: 7,
      },
    ],
  });

  await prisma.coupon.createMany({
    data: [
      {
        code: 'WELCOME100',
        description: '৳100 off your first order above ৳1,000',
        type: 'FIXED',
        value: toPoisha(100),
        minOrderAmount: toPoisha(1000),
        perUserLimit: 1,
        startsAt: new Date(now - DAY),
        endsAt: new Date(now + 180 * DAY),
      },
      {
        code: 'SAVE10',
        description: '10% off up to ৳500 on orders above ৳2,000',
        type: 'PERCENTAGE',
        value: 10,
        minOrderAmount: toPoisha(2000),
        maxDiscount: toPoisha(500),
        usageLimit: 1000,
        perUserLimit: 3,
        startsAt: new Date(now - DAY),
        endsAt: new Date(now + 60 * DAY),
      },
    ],
  });

  console.log(`✓ 2 campaigns, 1 flash sale (${flashVariants.length} items), 6 banners, 8 quick links, 2 coupons`);
}

async function main() {
  await seedGeo();
  await seedPlatformSettings();
  const house = await seedAdminAndHouseStore();
  const sellers = await seedSellers();
  const customers = await seedCustomers();
  await seedCatalog(sellers, house.id, customers);
  await seedContent(prisma);
}

main()
  .then(() => console.log('Seed complete.'))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
