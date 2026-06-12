import React, { createContext, useContext, useState, useCallback } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface AuthUser {
  id: number;
  userId: string;
  name: string;
  email: string;
  role: string;
  employeeId: number | null;
  firstName: string | null;
  lastName: string | null;
  profilePhoto: string | null;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const TOKEN_KEY = "hrms_token";
const USER_KEY = "hrms_user";

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Module-level token reference ─────────────────────────────────────────────
// Kept outside React so the getter is available the instant the module loads,
// before any useEffect runs. React Query fires on mount — this ensures the
// Authorization header is attached to the very first request.
let _currentToken: string | null = localStorage.getItem(TOKEN_KEY);

// Register the getter once at module load time.
// It always reads the live _currentToken value.
setAuthTokenGetter(() => _currentToken);

// ── Helper for raw fetch() calls that bypass the API client ──────────────────
// Use this anywhere you call fetch("/api/...") directly in pages/components.
export function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (_currentToken && !headers.has("authorization")) {
    headers.set("Authorization", `Bearer ${_currentToken}`);
  }
  return fetch(input, { ...init, headers });
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    // Sync module-level ref on initial render too (handles SSR/HMR edge cases)
    _currentToken = localStorage.getItem(TOKEN_KEY);
    return _currentToken;
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any).message || "Login failed");
    }

    const data = await res.json();
    const newToken: string = data.token;
    const newUser: AuthUser = data.user;

    // Update module-level ref first so the getter is live before React re-renders
    _currentToken = newToken;

    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    _currentToken = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, user, isAuthenticated: !!token && !!user, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
