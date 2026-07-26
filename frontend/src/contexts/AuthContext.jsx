import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  signUp as signUpService,
  signIn as signInService,
  signOut as signOutService,
  resendVerification as resendVerificationService,
  resetPassword as resetPasswordService,
  updatePassword as updatePasswordService,
} from "../services/auth/authService";

const AuthContext = createContext();

const mapSupabaseUser = (sbUser) => {
  if (!sbUser) return null;
  return {
    ...sbUser,
    id: sbUser.id,
    email: sbUser.email,
    name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || "User",
    role: sbUser.user_metadata?.role || "patient",
    verified: !!sbUser.email_confirmed_at,
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hash = window.location.hash || "";
    if (hash.includes("type=signup") || (hash.includes("access_token") && hash.includes("type=signup"))) {
      setLoading(true);
      supabase.auth.signOut().then(() => {
        window.location.hash = "";
        window.location.href = "/login?verified=true";
      });
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(mapSupabaseUser(session?.user ?? null));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (window.location.hash.includes("type=signup")) return;

      if (session?.user) {
        setUser(mapSupabaseUser(session.user));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    const res = await signInService(email, password);
    if (!res.error && res.data?.user) {
      setUser(mapSupabaseUser(res.data.user));
    }
    return res;
  };

  const signUp = async (email, password, metadata) => {
    return await signUpService(email, password, metadata);
  };

  const signOut = async () => {
    const res = await signOutService();
    if (!res.error) {
      setUser(null);
    }
    return res;
  };

  const resetPassword = async (email) => {
    return await resetPasswordService(email);
  };

  const resendVerification = async (email) => {
    return await resendVerificationService(email);
  };

  const updatePassword = async (password) => {
    return await updatePasswordService(password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        resendVerification,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}