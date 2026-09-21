"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api, getToken, setToken } from "./api";
import type { Role, User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/api/auth/me")
      .then((u) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = (token: string, u: User) => {
    setToken(token);
    setUser(u);
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Home path for a role. */
export function homeFor(role: Role): string {
  if (role === "youth") return "/youth/profile";
  if (role === "recruiter") return "/recruiter";
  if (role === "provider") return "/provider";
  return "/mla";
}

/** Client-side guard hook: redirects if the user isn't in `roles`. */
export function useRequireRole(roles: Role[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!roles.includes(user.role)) {
      router.replace(homeFor(user.role));
    }
  }, [user, loading, roles, router]);
  return { user, loading };
}
