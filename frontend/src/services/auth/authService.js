import { supabase } from "../../lib/supabase";

export async function signUp(email, password, { name, role }) {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role: role,
      },
      emailRedirectTo: `${window.location.origin}/login?verified=true`,
    },
  });
}

export async function signIn(email, password) {
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
}

export async function signOut() {
  return await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function resendVerification(email) {
  return await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/login?verified=true`,
    },
  });
}

export async function resetPassword(email) {
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

export async function updatePassword(password) {
  return await supabase.auth.updateUser({ password });
}