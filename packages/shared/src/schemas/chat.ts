import { z } from 'zod';
import { IdSchema, PaginationQuerySchema, SlugSchema } from './common.js';

/**
 * Opens (or reuses) the customer's thread with a shop. With only `productId`, the product's shop is used;
 * with neither, the thread goes to the store itself (house store).
 */
export const StartConversationSchema = z.object({
  sellerSlug: SlugSchema.optional(),
  productId: IdSchema.optional(),
});

export const SendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Write a message').max(2000, 'Keep messages under 2000 characters'),
  /** Product the message is about (shared from a product page). */
  productId: IdSchema.optional(),
});

export const MessageListQuerySchema = z.object({
  /** Latest N messages; the client raises it to load older history. */
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const ConversationListQuerySchema = PaginationQuerySchema;

export type StartConversationInput = z.input<typeof StartConversationSchema>;
export type SendMessageInput = z.input<typeof SendMessageSchema>;
export type MessageListQuery = z.input<typeof MessageListQuerySchema>;
export type ConversationListQuery = z.input<typeof ConversationListQuerySchema>;
