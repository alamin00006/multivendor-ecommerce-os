import { Platform } from 'react-native';

const fallback = Platform.select({
  android: 'http://10.0.2.2:4000/api/v1',
  default: 'http://localhost:4000/api/v1',
});

/** API base URL — set EXPO_PUBLIC_API_URL in apps/mobile/.env for devices on your LAN. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? fallback).replace(/\/$/, '');

/** Image through the API resize endpoint (WebP, cached for a year). */
export const img = (url: string | null | undefined, width = 400): string | undefined => {
  if (!url) return undefined;
  const w = Math.ceil(width * 2); // retina
  return `${API_URL}/images/resize?url=${encodeURIComponent(url)}&width=${w}`;
};
