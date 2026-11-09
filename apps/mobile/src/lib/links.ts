import type { Href } from 'expo-router';
import type { LinkTargetType } from '@marketbd/shared';

/** Maps admin-managed link targets (banners, quick links) to app routes. */
export const linkHref = (type: LinkTargetType, value: string): Href | null => {
  switch (type) {
    case 'CATEGORY':
      return `/category/${value}`;
    case 'CAMPAIGN':
      return `/campaign/${value}`;
    case 'PRODUCT':
      return `/product/${value}`;
    case 'BRAND':
      return { pathname: '/search', params: { brand: value } };
    case 'SEARCH':
      return value === 'flash-sale' ? '/flash-sale' : { pathname: '/search', params: { q: value } };
    case 'EXTERNAL':
      return null;
  }
};
