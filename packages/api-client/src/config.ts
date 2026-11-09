import type { AuthTokens } from '@marketbd/shared';

/**
 * Platform hooks the shared API layer needs. Web keeps the refresh token in an
 * httpOnly cookie (credentials: 'include'); mobile stores it in SecureStore.
 */
export interface ApiClientConfig {
  /** e.g. http://localhost:4000/api/v1 */
  baseUrl: string;
  credentials?: RequestCredentials;
  /** Returns the stored refresh token (mobile). Web returns null and relies on the cookie. */
  loadRefreshToken?: () => Promise<string | null>;
  /** Persists or clears the refresh token after sign-in, refresh and sign-out. */
  saveRefreshToken?: (token: string | null) => Promise<void>;
  /** Current UI language for Accept-Language. */
  getLocale?: () => 'en' | 'bn';
  /** Called once a session can no longer be refreshed. */
  onSessionExpired?: () => void;
}

let current: ApiClientConfig = { baseUrl: 'http://localhost:4000/api/v1', credentials: 'include' };

export const configureApiClient = (config: ApiClientConfig): void => {
  current = { credentials: 'include', ...config };
};

export const apiConfig = (): ApiClientConfig => current;

export const persistTokens = async (tokens: AuthTokens | null): Promise<void> => {
  await current.saveRefreshToken?.(tokens?.refreshToken ?? null);
};
