import { z } from 'zod';
import { AddressLabelSchema } from '../enums.js';
import { BdPhoneSchema } from './common.js';
import { NameSchema } from './auth.js';

export const AddressSchema = z.object({
  label: AddressLabelSchema.default('HOME'),
  fullName: NameSchema,
  phone: BdPhoneSchema,
  divisionId: z.coerce.number().int().positive('Select a division'),
  districtId: z.coerce.number().int().positive('Select a district'),
  areaId: z.coerce.number().int().positive('Select an area'),
  addressLine: z.string().trim().min(5, 'Enter house, road and block').max(255),
  landmark: z.string().trim().max(120).optional(),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.input<typeof AddressSchema>;
export type AddressPayload = z.infer<typeof AddressSchema>;

export const UpdateAddressSchema = AddressSchema.partial();
export type UpdateAddressInput = z.input<typeof UpdateAddressSchema>;
export type UpdateAddressPayload = z.infer<typeof UpdateAddressSchema>;
