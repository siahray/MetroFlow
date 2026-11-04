import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getAuthToken, setAuthToken, type AuthUser } from "./api";

// The driver stays signed in across app restarts until they sign out (FSD-FR-022).
const SESSION_KEY = "metroflow_session";

type AuthState = {
  user: AuthUser | null;
  /** False until the saved session has been read, so the app does not flash the login screen. */
  ready: boolean;
  signIn: (user: AuthUser) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState>({
  user: null,
  ready: false,
  signIn: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as { user?: AuthUser; token?: string | null };
        if (!saved.user || !saved.token) return;
        setAuthToken(saved.token);
        setUser(saved.user);
      })
      .catch(() => {
        // An unreadable store is just a signed-out start.
      })
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback((next: AuthUser) => {
    setUser(next);
    AsyncStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ user: next, token: getAuthToken() }),
    ).catch(() => {
      // The session still works for this run; it just will not outlive the app.
    });
  }, []);

  const signOut = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signOut }),
    [user, ready, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
