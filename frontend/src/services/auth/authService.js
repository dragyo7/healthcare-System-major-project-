import { supabase } from "../../lib/supabase";

export async function signUp(email, password, { name, role }) {
  try {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          // Security Invariant: Client self-registration defaults strictly to patient role
          role: role === "doctor" ? "patient" : (role || "patient"),
        },
        emailRedirectTo: `${window.location.origin}/login?verified=true`,
      },
    });
  } catch (err) {
    return { data: null, error: { message: err?.message || "Cloud registration service is currently unreachable." } };
  }
}

export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    if (data?.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      return { error: { message: "Please verify your email address before logging in." } };
    }

    return { data };
  } catch (err) {
    return { data: null, error: { message: err?.message || "Cloud authentication service is currently unreachable." } };
  }
}

export async function signOut() {
  try {
    return await supabase.auth.signOut();
  } catch (err) {
    return { error: { message: err?.message || "Sign out encountered an error." } };
  }
}

export async function getCurrentUser() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function resendVerification(email) {
  try {
    return await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login?verified=true`,
      },
    });
  } catch (err) {
    return { data: null, error: { message: err?.message || "Verification service is currently unreachable." } };
  }
}

export async function resetPassword(email) {
  try {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  } catch (err) {
    return { data: null, error: { message: err?.message || "Password reset service is currently unreachable." } };
  }
}

export async function updatePassword(password) {
  try {
    return await supabase.auth.updateUser({ password });
  } catch (err) {
    return { data: null, error: { message: err?.message || "Update password service is currently unreachable." } };
  }
}