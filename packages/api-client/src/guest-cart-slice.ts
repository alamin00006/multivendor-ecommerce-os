import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { CART } from '@marketbd/shared';

/** Snapshot shown in the guest cart UI until the user signs in and the cart is merged server-side. */
export interface GuestCartItem {
  variantId: string;
  quantity: number;
  productId: string;
  slug: string;
  title: string;
  titleBn: string | null;
  imageUrl: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  variantLabel: string;
  stock: number;
  selected: boolean;
}

export interface GuestCartState {
  items: GuestCartItem[];
}

const initialState: GuestCartState = { items: [] };

export const guestCartSlice = createSlice({
  name: 'guestCart',
  initialState,
  reducers: {
    guestCartHydrated(state, action: PayloadAction<GuestCartItem[]>) {
      state.items = action.payload;
    },
    guestItemAdded(state, action: PayloadAction<GuestCartItem>) {
      const existing = state.items.find((i) => i.variantId === action.payload.variantId);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + action.payload.quantity, CART.maxQuantityPerItem, existing.stock);
        existing.selected = true;
      } else if (state.items.length < CART.maxItems) {
        state.items.unshift({ ...action.payload, quantity: Math.min(action.payload.quantity, action.payload.stock) });
      }
    },
    guestItemUpdated(state, action: PayloadAction<{ variantId: string; quantity?: number; selected?: boolean }>) {
      const item = state.items.find((i) => i.variantId === action.payload.variantId);
      if (!item) return;
      if (action.payload.quantity !== undefined) {
        item.quantity = Math.max(1, Math.min(action.payload.quantity, CART.maxQuantityPerItem, item.stock));
      }
      if (action.payload.selected !== undefined) item.selected = action.payload.selected;
    },
    guestAllSelected(state, action: PayloadAction<boolean>) {
      state.items.forEach((i) => {
        i.selected = action.payload;
      });
    },
    guestItemRemoved(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.variantId !== action.payload);
    },
    guestCartCleared(state) {
      state.items = [];
    },
  },
});

export const {
  guestCartHydrated,
  guestItemAdded,
  guestItemUpdated,
  guestAllSelected,
  guestItemRemoved,
  guestCartCleared,
} = guestCartSlice.actions;

export interface RootStateWithGuestCart {
  guestCart: GuestCartState;
}

export const selectGuestCart = (s: RootStateWithGuestCart) => s.guestCart.items;
