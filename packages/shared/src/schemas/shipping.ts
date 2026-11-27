import { z } from 'zod';
import { BdPhoneSchema } from './common.js';

export const COURIER_PROVIDERS = ['PATHAO', 'STEADFAST'] as const;
export const CourierProviderSchema = z.enum(COURIER_PROVIDERS);
export type CourierProviderCode = (typeof COURIER_PROVIDERS)[number];

export interface CourierCredentialField {
  key: string;
  label: string;
  /** Never sent back to the browser once saved. */
  secret?: boolean;
  help?: string;
}

export interface CourierCatalogEntry {
  name: string;
  /** Each seller is registered as a pickup store, so the rider collects from the seller's own address. */
  supportsStores: boolean;
  /** Has a separate sandbox environment. */
  hasSandbox: boolean;
  /** The courier needs the parcel weight when booking. */
  needsWeight: boolean;
  fields: CourierCredentialField[];
  /** Shown to the admin next to the webhook settings. */
  webhookHelp: string;
  note?: string;
}

/**
 * Couriers the platform can book with. Adding a courier = one entry here + one adapter in the API.
 * The admin enables each one and enters its credentials in Admin → Couriers.
 */
export const COURIER_CATALOG: Record<CourierProviderCode, CourierCatalogEntry> = {
  PATHAO: {
    name: 'Pathao',
    supportsStores: true,
    hasSandbox: true,
    needsWeight: true,
    fields: [
      { key: 'clientId', label: 'Client ID', help: 'Pathao merchant panel → Developer API' },
      { key: 'clientSecret', label: 'Client secret', secret: true },
      { key: 'username', label: 'Merchant login email' },
      { key: 'password', label: 'Merchant login password', secret: true },
    ],
    webhookHelp: 'In Pathao → Developer API → Webhook, paste the URL and use the secret as the webhook secret.',
  },
  STEADFAST: {
    name: 'Steadfast',
    supportsStores: false,
    hasSandbox: false,
    needsWeight: false,
    fields: [
      { key: 'apiKey', label: 'API key', help: 'Steadfast merchant panel → API' },
      { key: 'secretKey', label: 'Secret key', secret: true },
    ],
    webhookHelp: 'In Steadfast → API → Webhook, paste the URL and use the secret as the Bearer token.',
    note: 'Steadfast collects parcels from the pickup address on the Steadfast account (for example your hub or house store), not from each seller.',
  },
};

/** Admin saves a courier account. Blank credential fields keep the saved value. */
export const CourierAccountSchema = z.object({
  enabled: z.boolean(),
  sandbox: z.boolean().default(false),
  credentials: z.record(z.string(), z.string().trim().max(500)).default({}),
});
export type CourierAccountInput = z.input<typeof CourierAccountSchema>;

/** A shop connects its own courier account (own delivery). Pathao also needs the shop's store id. */
export const SellerCourierAccountSchema = CourierAccountSchema.extend({
  storeExternalId: z.string().trim().max(40).optional(),
});
export type SellerCourierAccountInput = z.input<typeof SellerCourierAccountSchema>;

const LocationId = z.coerce.number().int().positive();

/** A seller's pickup point at the courier. City/zone/area ids come from the courier's location lists. */
export const CourierStoreSchema = z.object({
  contactName: z.string().trim().min(3, 'Enter at least 3 characters').max(50),
  contactNumber: BdPhoneSchema,
  address: z.string().trim().min(15, 'Enter the full pickup address (at least 15 characters)').max(120),
  cityId: LocationId,
  zoneId: LocationId,
  areaId: LocationId,
});
export type CourierStoreInput = z.infer<typeof CourierStoreSchema>;

/** Parcel details confirmed when booking the courier. */
export const BookShipmentSchema = z.object({
  provider: CourierProviderSchema,
  /** Parcel weight in kg (Pathao accepts 0.5–10). */
  itemWeight: z.coerce.number().min(0.5, 'Minimum 0.5 kg').max(10, 'Maximum 10 kg').default(0.5),
  itemDescription: z.string().trim().max(200).optional(),
  specialInstruction: z.string().trim().max(200).optional(),
});
export type BookShipmentInput = z.input<typeof BookShipmentSchema>;
