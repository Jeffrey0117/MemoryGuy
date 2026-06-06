import { useState, useEffect, useCallback, useRef } from 'react';

// Shared LetMeUse login wall (ported from RePic). The login JWT is used as the Bearer
// token for pokkit virtualization uploads. The SDK is loaded by <script> in index.html
// as window.letmeuse.
interface LetMeUseSdk {
  ready: boolean;
  user: unknown;
  getToken: () => string | null;
  login: () => void;
  logout: () => void;
  onAuthChange: (cb: (user: unknown) => void) => (() => void) | void;
}

function getSdk(): LetMeUseSdk | undefined {
  return (window as unknown as { letmeuse?: LetMeUseSdk }).letmeuse;
}

const STORAGE_KEY_USER = 'memoryguy-letmeuse-user';
const STORAGE_KEY_TOKEN = 'memoryguy-letmeuse-token';

function loadCachedAuth(): { user: unknown; token: string | null } {
  try {
    const userStr = localStorage.getItem(STORAGE_KEY_USER);
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (userStr && token) return { user: JSON.parse(userStr), token };
  } catch {
    // ignore corrupted cache
  }
  return { user: null, token: null };
}

function persistAuth(user: unknown, token: string | null): void {
  try {
    if (user && token) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
  } catch {
    // localStorage may be full or disabled
  }
}

export function useLetMeUse() {
  const cached = loadCachedAuth();
  const [user, setUser] = useState<unknown>(cached.user);
  const [token, setToken] = useState<string | null>(cached.token);
  const [isLoading, setIsLoading] = useState(true);
  const sdkInitialized = useRef(false);

  useEffect(() => {
    let unsubscribe: (() => void) | void;
    let attempts = 0;
    const maxAttempts = 50;

    const tryInit = () => {
      const sdk = getSdk();
      if (!sdk || !sdk.ready) {
        attempts++;
        if (attempts < maxAttempts) setTimeout(tryInit, 100);
        else setIsLoading(false);
        return;
      }

      setUser(sdk.user);
      setToken(sdk.getToken());
      persistAuth(sdk.user, sdk.getToken());
      setIsLoading(false);
      sdkInitialized.current = true;

      unsubscribe = sdk.onAuthChange((newUser) => {
        if (!newUser) {
          if (sdkInitialized.current) {
            setUser(null);
            setToken(null);
            persistAuth(null, null);
          }
          return;
        }
        const newToken = sdk.getToken();
        setUser(newUser);
        setToken(newToken);
        persistAuth(newUser, newToken);
      });
    };

    tryInit();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const login = useCallback(() => { getSdk()?.login(); }, []);
  const logout = useCallback(() => {
    getSdk()?.logout();
    setUser(null);
    setToken(null);
    persistAuth(null, null);
  }, []);

  const isAuthenticated = !!user && !!token;

  return { user, token, isLoading, isAuthenticated, login, logout };
}
