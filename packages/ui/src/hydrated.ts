'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during SSR and the hydration render, true afterwards.
 * Use it to gate UI that depends on client-fetched data (e.g. public settings), because a
 * streamed segment can hydrate after that data has already arrived, which would otherwise
 * produce different HTML than the server rendered.
 */
export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
