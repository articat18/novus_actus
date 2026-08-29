import type { AuthUser } from "@energy/shared";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, ApiError } from "./api";

const TOKEN_KEY = "energy.accessToken";

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True while an existing token is being validated on startup. */
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, name: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token === null) {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // Storage may be unavailable (private mode); the session simply won't persist.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => readToken() !== null);

  // Validate a persisted token on startup (and whenever it changes).
  useEffect(() => {
    let active = true;
    if (token === null) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .me(token)
      .then((fetched) => {
        if (active) {
          setUser(fetched);
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setUser(null);
        if (error instanceof ApiError && error.status === 401) {
          writeToken(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      loading,
      async signIn(email, password) {
        const session = await api.signIn({ email, password });
        writeToken(session.accessToken);
        setToken(session.accessToken);
        setUser(session.user);
        setLoading(false);
      },
      async signUp(email, name, password) {
        const session = await api.signUp({ email, name, password });
        writeToken(session.accessToken);
        setToken(session.accessToken);
        setUser(session.user);
        setLoading(false);
      },
      async signOut() {
        const current = token;
        writeToken(null);
        setToken(null);
        setUser(null);
        if (current !== null) {
          try {
            await api.signOut(current);
          } catch {
            // Local sign-out already happened; ignore network/revocation errors.
          }
        }
      },
    }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
