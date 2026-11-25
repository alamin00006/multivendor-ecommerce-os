import { BRAND } from './constants.js';

/** Live values from Admin → Settings that the help texts mention. */
export interface HelpContext {
  returnDays: number;
  supportPhone: string;
  supportEmail: string;
  hours: string;
}

export interface HelpQuestion {
  q: string;
  a: string;
}

/** A Help Center topic: a list of questions and answers. */
export interface HelpTopic {
  slug: string;
  title: string;
  faq: HelpQuestion[];
}

/** A policy / content page (About us, Privacy policy…). */
export interface ContentPage {
  slug: string;
  title: string;
  sections: Array<{ heading?: string; paragraphs: string[] }>;
}

/** Shortcuts at the top of the Help Center (paths are the website's; the app maps them to its screens). */
export const HELP_SHORTCUTS = [
  { key: 'profile', label: 'Edit My Profile', href: '/account/profile' },
  { key: 'to-pay', label: 'Payment Pending', href: '/account/orders?tab=to-pay' },
  { key: 'addresses', label: 'My Addresses', href: '/account/addresses' },
  { key: 'orders', label: 'Track My Order', href: '/account/orders' },
  { key: 'cancel', label: 'Cancel My Order', href: '/account/cancellations' },
  { key: 'returns', label: 'Return Product', href: '/account/returns' },
  { key: 'password', label: 'Change Password', href: '/account/profile' },
  { key: 'notifications', label: 'Notifications', href: '/account/notifications' },
] as const;
export type HelpShortcutKey = (typeof HELP_SHORTCUTS)[number]['key'];

/** Help Center topics shared by the website and the app. */
export const helpTopics = (c: HelpContext): HelpTopic[] => [
  {
    slug: 'campaigns',
    title: 'Campaigns',
    faq: [
      { q: 'What is a campaign?', a: `A campaign is a sale event on ${BRAND.name} — for example a mega sale or a brand day. Campaign pages are linked from the home page banners and show the products, vouchers and rules of the event.` },
      { q: 'Do campaign prices last after the campaign ends?', a: 'No. Campaign prices and vouchers are valid only while the campaign is live. The countdown on the campaign page shows how much time is left.' },
      { q: 'Why did a campaign product sell out so fast?', a: 'Campaign stock is often limited. Items are sold on a first come, first served basis, so add them to your cart and check out early.' },
    ],
  },
  {
    slug: 'vouchers',
    title: 'Vouchers',
    faq: [
      { q: 'How do I collect a voucher?', a: 'Open the Voucher Center, a campaign page or a product page and tap Collect. Collected vouchers are saved under My Voucher.' },
      { q: 'How do I use a voucher?', a: 'At checkout, the collected vouchers that fit your cart are listed. Pick one and the discount is applied straight away. You can also type a voucher code.' },
      { q: 'Can I use more than one voucher?', a: 'One voucher can be used per order.' },
      { q: 'Why is my voucher not working?', a: 'Check the minimum spend, the expiry date and any rule on the voucher — store vouchers only work for that shop’s items and payment vouchers only work with that payment method.' },
    ],
  },
  {
    slug: 'my-account',
    title: 'My Account',
    faq: [
      { q: 'How do I create an account?', a: 'Tap Sign up and register with your email or mobile number. You can also sign in with a one-time code sent to your phone.' },
      { q: 'How do I update my name, birthday or gender?', a: 'Go to My Account → My Profile and choose Edit profile.' },
      { q: 'How do I manage my delivery addresses?', a: 'Go to My Account → Address Book to add, edit or remove addresses and to choose a default address.' },
    ],
  },
  {
    slug: 'account-security',
    title: 'Account Security',
    faq: [
      { q: 'How do I change my password?', a: 'Go to My Account → My Profile and choose Change password.' },
      { q: 'I forgot my password. What should I do?', a: 'Sign in with a one-time code sent to your mobile number, then set a new password from My Profile.' },
      { q: `Will ${BRAND.name} ever ask for my password or OTP?`, a: `No. ${BRAND.name} staff will never ask for your password, OTP or card details. Do not share them with anyone.` },
    ],
  },
  {
    slug: 'privacy-security',
    title: 'Privacy & Security',
    faq: [
      { q: 'How is my personal information used?', a: 'Only to process and deliver your orders and to support you. Read the Privacy policy for details.' },
      { q: 'Are my payment details stored?', a: 'No. Card and wallet payments are handled by licensed payment partners; we never store your card details.' },
    ],
  },
  {
    slug: 'order-placement',
    title: 'Order Placement',
    faq: [
      { q: 'How do I place an order?', a: 'Add products to your cart, tap Checkout, choose a delivery address and a payment method, then place the order. You get a confirmation in Notifications.' },
      { q: 'Are all products new and genuine?', a: `Yes. Sellers on ${BRAND.name} must sell new, genuine products. Products from the official store are sourced directly from brands and distributors.` },
      { q: 'Why can I not add a product to my cart?', a: 'The product may be out of stock, or you may have reached the maximum quantity allowed per order.' },
      { q: 'How do I contact a seller?', a: 'Tap Chat on the product or shop page. Replies show up under Messages.' },
    ],
  },
  {
    slug: 'order-management',
    title: 'Order Management',
    faq: [
      { q: 'How do I track my order?', a: 'Go to My Orders and open the order. Every package shows its current status and the tracking number once it is shipped.' },
      { q: 'Can I cancel my order?', a: 'Yes, until it is shipped. Go to My Cancellations (or open the order) and tap Cancel order.' },
      { q: 'Why did my order arrive in several packages?', a: 'Items from different shops are packed and shipped separately, so one order can arrive in more than one package.' },
    ],
  },
  {
    slug: 'rating-reviews',
    title: 'Rating & Reviews',
    faq: [
      { q: 'How do I review a product?', a: 'After delivery, go to My Reviews → To Review and rate the product. You can add a comment and photos.' },
      { q: 'Why was my review hidden?', a: 'Reviews with offensive language, personal information or unrelated content may be hidden by our team.' },
      { q: 'Can sellers reply to my review?', a: 'Yes. The shop’s reply is shown under your review and you get a notification.' },
    ],
  },
  {
    slug: 'shipping-journey',
    title: 'Shipping Journey',
    faq: [
      { q: 'How long does delivery take?', a: 'Usually 1–3 days inside Dhaka and 3–5 days outside Dhaka. The estimate for your address is shown at checkout.' },
      { q: 'How much is the delivery fee?', a: 'The fee depends on your delivery zone and is shown at checkout before you pay. Some vouchers give free delivery.' },
      { q: 'What do the order statuses mean?', a: 'Pending → the shop has received it; Confirmed → accepted; Packing → being prepared; Shipped → with the courier; Delivered → handed to you.' },
    ],
  },
  {
    slug: 'payment-methods',
    title: 'Payment Methods',
    faq: [
      { q: 'Which payment methods are accepted?', a: 'Cash on Delivery everywhere in Bangladesh, bKash, and cards / mobile banking through SSLCommerz (when available).' },
      { q: 'My online payment failed. What now?', a: 'Your order is saved. Open it from My Orders and tap Pay now to try again, or contact us if money was taken from your account.' },
    ],
  },
  {
    slug: 'refund-policy',
    title: 'Refund Policy',
    faq: [
      { q: 'When will I get a refund?', a: 'For cancelled paid orders, and for returns once the shop receives the item.' },
      { q: 'How is the refund paid?', a: 'To the original payment method (bKash or card). Cash on Delivery orders are refunded to your bKash number.' },
    ],
  },
  {
    slug: 'refund-process',
    title: 'Refund Process',
    faq: [
      { q: 'How long does a refund take?', a: 'Usually 5–7 working days after the refund is issued, depending on your bank or wallet.' },
      { q: 'How do I know my refund was issued?', a: 'The order and the return show “Refunded” and you get a notification.' },
    ],
  },
  {
    slug: 'return-policy',
    title: 'Return Policy',
    faq: [
      { q: 'How many days do I have to return an item?', a: `You can request a return within ${c.returnDays} days of delivery.` },
      { q: 'Which items can be returned?', a: 'Items that are wrong, damaged, defective or not as described. They must be unused, with original packaging, tags and accessories.' },
      { q: 'Which items cannot be returned?', a: 'Used items, items without original packaging, perishable groceries, and personal-care items once opened.' },
    ],
  },
  {
    slug: 'return-process',
    title: 'Return Process',
    faq: [
      { q: 'How do I return an item?', a: 'Go to My Returns → Initiate Return, choose the package, describe the problem and add photos.' },
      { q: 'What happens after I request a return?', a: 'The shop approves or rejects it (usually within 2 working days) and tells you how to send the item back. Once the shop receives it, your refund is issued.' },
      { q: 'How do I follow my return?', a: 'Open My Returns → Track Return to see each step: Requested, Approved, Received and Refunded.' },
    ],
  },
  {
    slug: 'warranty-policy',
    title: 'Warranty Policy',
    faq: [
      { q: 'Which products have a warranty?', a: 'Products with a warranty show it on the product page under Delivery & Services.' },
      { q: 'How do I claim a warranty?', a: 'Keep your invoice and contact the brand’s service centre or the shop through Chat with your order number.' },
    ],
  },
];

/** Policy and company pages shared by the website and the app. */
export const contentPages = (c: HelpContext): ContentPage[] => [
  {
    slug: 'about',
    title: 'About Us',
    sections: [
      {
        heading: `About ${BRAND.name}`,
        paragraphs: [
          `${BRAND.name} is an online marketplace built for Bangladesh. We bring trusted sellers and our own official store together so you can shop everything from groceries to gadgets in one place.`,
          'Orders are delivered across all 64 districts, with Cash on Delivery available everywhere.',
        ],
      },
      {
        heading: 'Why shop with us',
        paragraphs: [
          'Genuine products from verified sellers, clear prices with no hidden charges, easy returns and friendly customer care every day.',
        ],
      },
    ],
  },
  {
    slug: 'returns',
    title: 'Return & Refund Policy',
    sections: [
      { heading: 'Returns', paragraphs: [`You can request a return within ${c.returnDays} days of delivery from My Returns → Initiate Return. Items must be unused, in original packaging, with all tags and accessories.`, 'The shop approves or rejects the request — usually within 2 working days — and tells you how to send the item back.'] },
      { heading: 'Refunds', paragraphs: ['Once the shop receives the item, the refund goes to the original payment method (bKash or card) within 5–7 working days. Cash on Delivery orders are refunded to your bKash number.'] },
    ],
  },
  {
    slug: 'warranty',
    title: 'Warranty Policy',
    sections: [{ paragraphs: ['Warranty terms are set by the brand or seller and are shown on the product page. Keep your invoice and contact the service centre or the shop through Chat to claim it.'] }],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    sections: [
      { paragraphs: ['We collect only the information needed to process your orders: your name, contact details, delivery addresses and order history.', 'Payment details are handled by our licensed payment partners and are never stored on our servers.', 'You can update your profile or ask us to delete your account at any time by contacting support.'] },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookies Policy',
    sections: [{ paragraphs: ['We use cookies to keep you signed in, remember your cart and understand how the site is used. You can clear cookies from your browser settings at any time.'] }],
  },
  {
    slug: 'terms',
    title: 'Terms & Conditions',
    sections: [{ paragraphs: ['Prices and availability may change without notice. Orders are confirmed once a seller accepts them.', 'Sellers are responsible for the accuracy of their listings. We may remove listings that break our policies.'] }],
  },
  {
    slug: 'careers',
    title: 'Careers',
    sections: [{ paragraphs: ['We are always looking for engineers, designers, category managers and customer-care specialists. Send your CV to careers@marketbd.example.'] }],
  },
];

/** Builds the help context from public settings, falling back to the brand defaults. */
export const helpContext = (settings?: { returns?: { days: number }; store?: { phone?: string; email?: string; hours?: string } } | null): HelpContext => ({
  returnDays: settings?.returns?.days ?? 7,
  supportPhone: settings?.store?.phone || BRAND.supportPhone,
  supportEmail: settings?.store?.email || BRAND.supportEmail,
  hours: settings?.store?.hours || '9am–9pm, every day',
});
