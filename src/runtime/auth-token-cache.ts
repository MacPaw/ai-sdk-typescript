export type AuthTokenLoader = (forceRefresh?: boolean) => Promise<string | null>;

export interface AuthTokenCache {
  get(forceRefresh?: boolean): Promise<string | null>;
  clear(): void;
}

export interface CreateAuthTokenCacheOptions {
  loadToken: AuthTokenLoader;
  ttlMs?: number;
}

export function createAuthTokenCache(options: CreateAuthTokenCacheOptions): AuthTokenCache {
  const { loadToken, ttlMs = 0 } = options;

  let cachedToken: string | null = null;
  let cacheExpiresAt = 0;
  let pendingRefresh: Promise<string | null> | null = null;
  let pendingIsForced = false;

  return {
    async get(forceRefresh = false): Promise<string | null> {
      if (ttlMs <= 0) {
        return loadToken(forceRefresh);
      }

      if (!forceRefresh && Date.now() < cacheExpiresAt) {
        return cachedToken;
      }

      if (forceRefresh && pendingRefresh && !pendingIsForced) {
        pendingRefresh = null;
      }

      if (!pendingRefresh) {
        pendingIsForced = forceRefresh;
        pendingRefresh = loadToken(forceRefresh).then(
          (token) => {
            cachedToken = token;
            cacheExpiresAt = token == null ? 0 : Date.now() + ttlMs;
            pendingRefresh = null;
            return token;
          },
          (error) => {
            pendingRefresh = null;
            throw error;
          },
        );
      }

      return pendingRefresh;
    },

    clear(): void {
      cachedToken = null;
      cacheExpiresAt = 0;
      pendingRefresh = null;
      pendingIsForced = false;
    },
  };
}
