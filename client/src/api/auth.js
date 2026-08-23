import { supabase } from "../lib/supabaseClient.js";

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error && error?.name !== "AuthSessionMissingError") throw friendlyAuthError(error);
  return data.user || null;
}

export function observeAuth(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user || null));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw friendlyAuthError(error);
  return data.user;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw friendlyAuthError(error);
  return { user: data.user, needsConfirmation: !data.session };
}

export async function signInWithGoogle() {
  const redirectTo = new URL(import.meta.env.BASE_URL, window.location.href).href;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) throw friendlyAuthError(error);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw friendlyAuthError(error);
}

function friendlyAuthError(error) {
  const messages = {
    "Invalid login credentials": "El correo o la contrasena no coinciden.",
    "Email not confirmed": "Confirma el correo que te envio Supabase antes de entrar.",
    "User already registered": "Ese correo ya tiene una cuenta. Usa Entrar.",
    "Password should be at least 6 characters": "La contrasena debe tener al menos 6 caracteres.",
    "Unsupported provider: provider is not enabled": "El acceso con Google todavía debe habilitarse en Supabase.",
  };
  return new Error(messages[error?.message] || error?.message || "No se pudo acceder a tu cuenta.");
}
