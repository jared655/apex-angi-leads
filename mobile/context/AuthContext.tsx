import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { registerPushToken } from "@/lib/notifications";
import { clearSession, getStoredUser, getToken, setSession } from "@/lib/storage";
import type { User } from "@/lib/types";

type AuthState = {
  loading: boolean;
  user: User | null;
  teammates: User[];
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateName: (displayName: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [teammates, setTeammates] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ user: User; teammates: User[] }>("/auth/me");
      setUser(data.user);
      setTeammates(data.teammates);
      await setSession(token, JSON.stringify(data.user));
      void registerPushToken();
    } catch {
      await clearSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const stored = await getStoredUser();
      if (stored) {
        try {
          setUser(JSON.parse(stored) as User);
        } catch {
          // ignore
        }
      }
      await refresh();
    })();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const data = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await setSession(data.token, JSON.stringify(data.user));
    setUser(data.user);
    void registerPushToken();
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
    setTeammates([]);
  }, []);

  const updateName = useCallback(async (displayName: string) => {
    const data = await api<{ user: User }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ displayName }),
    });
    setUser(data.user);
    const token = await getToken();
    if (token) await setSession(token, JSON.stringify(data.user));
  }, []);

  const value = useMemo(
    () => ({ loading, user, teammates, error, login, logout, refresh, updateName }),
    [loading, user, teammates, error, login, logout, refresh, updateName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
