import { BRAND } from './constants.js';

/** Live values from Admin → Settings that the help texts mention. */
export interface HelpContext {
  returnDays: number;
  supportPhone: string;
  supportEmail: string;
  hours: string;
}

export interface HelpArticle {
  slug: string;
  title: string;
  /** Paragraphs. */
  body: string[];
  /** Optional questions and answers shown under the article. */
  faq?: Array<{ q: string; a: string }>;
}

/** Help center content shared by the website and the app. */
export const helpArticles = (c: HelpContext): HelpArticle[] => [
  {
    slug: 'faq',
    title: 'Frequently asked questions',
    body: ['Quick answers to the questions we hear most. Still stuck? Contact us — details are at the bottom of the help center.'],
    faq: [
      { q: 'How do I place an order?', a: 'Add products to your cart, tap Checkout, choose a delivery address and a payment method, then Place order. You will get a confirmation in Notifications.' },
      { q: 'Which payment methods can I use?', a: 'Cash on Delivery everywhere in Bangladesh, bKash, and cards / mobile banking through SSLCommerz (when enabled).' },
      { q: 'How long does delivery take?', a: 'Usually 1–3 days inside Dhaka and 3–5 days outside Dhaka. The estimate for your address is shown at checkout.' },
      { q: 'How do I use a voucher?', a: 'Collect vouchers from the Voucher Center or a product page. At checkout, collected vouchers that fit your cart are listed — pick one. One voucher can be used per order.' },
      { q: 'Can I cancel an order?', a: 'Yes, until it is shipped. Go to Account → My Cancellations (or open the order) and tap Cancel order. Paid orders are refunded to the original payment method.' },
      { q: `How do returns work?`, a: `Request a return within ${c.returnDays} days of delivery from Account → My Returns → Initiate Return. The shop reviews it, you send the item back, and the refund follows once the shop receives it.` },
      { q: 'Why was my payment not completed?', a: 'Your order is saved even if an online payment fails. Open the order and tap Pay now to try again, or contact us if money was taken.' },
      { q: 'How do I chat with a seller?', a: 'Tap Chat on a product or shop page. Replies show up under Messages, and you get a notification for new messages.' },
    ],
  },
  {
    slug: 'about',
    title: `About ${BRAND.name}`,
    body: [
      `${BRAND.name} is an online marketplace built for Bangladesh. We bring trusted sellers and our own official store together so you can shop everything from groceries to gadgets in one place.`,
      'Orders are delivered by our logistics partners across all 64 districts, with Cash on Delivery available everywhere.',
    ],
  },
  {
    slug: 'returns',
    title: 'Returns & refunds',
    body: [
      `You can request a return within ${c.returnDays} days of delivery from My Returns → Initiate Return (or from the order page). Add a short description and photos if the item is damaged or wrong.`,
      'Items must be unused, in original packaging, with all tags and accessories. The shop approves or rejects the request — usually within 2 working days — and tells you how to send the item back.',
      'Once the shop receives the item, the refund goes to the original payment method (bKash or card) within 5–7 working days. Cash on Delivery orders are refunded to your bKash number.',
    ],
  },
  {
    slug: 'shipping',
    title: 'Delivery',
    body: [
      'Each shop packs and ships its own items, so an order from several shops can arrive in separate packages. You can follow every package from My Orders.',
      'The delivery fee and the estimated delivery time for your address are shown at checkout before you pay.',
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy policy',
    body: [
      'We collect only the information needed to process your orders: your name, contact details, delivery addresses and order history.',
      'Payment details are handled by our licensed payment partners and are never stored on our servers.',
      'You can update your profile or ask us to delete your account at any time by contacting support.',
    ],
  },
  {
    slug: 'terms',
    title: 'Terms & conditions',
    body: [
      'Prices and availability may change without notice. Orders are confirmed once a seller accepts them.',
      'Sellers are responsible for the accuracy of their listings. We may remove listings that violate our policies.',
    ],
  },
  {
    slug: 'careers',
    title: 'Careers',
    body: ['We are always looking for engineers, designers, category managers and customer-care specialists. Send your CV to careers@marketbd.example.'],
  },
];

/** Intro shown on the help center home. */
export const helpIntro = (c: HelpContext): string[] => [
  `Need help with an order? Call ${c.supportPhone} (${c.hours}) or email ${c.supportEmail}.`,
  'Choose a topic for answers to common questions.',
];

/** Builds the help context from public settings, falling back to the brand defaults. */
export const helpContext = (settings?: { returns?: { days: number }; store?: { phone?: string; email?: string; hours?: string } } | null): HelpContext => ({
  returnDays: settings?.returns?.days ?? 7,
  supportPhone: settings?.store?.phone || BRAND.supportPhone,
  supportEmail: settings?.store?.email || BRAND.supportEmail,
  hours: settings?.store?.hours || '9am–9pm, every day',
});
