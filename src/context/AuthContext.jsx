import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

const AuthContext = createContext(null);
const AUTH_INIT_TIMEOUT_MS = 8000;

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      if (!isMounted) return;
      setAuthReady(true);
      setAuthError("認証状態の確認に時間がかかっています。ネットワーク状態をご確認ください。");
    }, AUTH_INIT_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (!isMounted) return;
        window.clearTimeout(timeoutId);
        setCurrentUser(user ?? null);
        setAuthError("");
        setAuthReady(true);
      },
      (error) => {
        if (!isMounted) return;
        window.clearTimeout(timeoutId);
        console.error("Auth state observation failed:", error);
        setCurrentUser(null);
        setAuthError("認証状態の取得に失敗しました。再読み込みをお試しください。");
        setAuthReady(true);
      }
    );

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ currentUser, authReady, authError }), [currentUser, authReady, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
