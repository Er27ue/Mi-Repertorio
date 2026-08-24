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

export async function signInWithPasskey() {
  const { data, error } = await supabase.auth.signInWithPasskey();
  if (error) throw friendlyAuthError(error);
  return data.user;
}

export async function registerPasskey() {
  const { data, error } = await supabase.auth.registerPasskey();
  if (error) throw friendlyAuthError(error);
  return data;
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
    passkey_disabled: "El acceso con huella todavía no está activado en Supabase.",
    webauthn_credential_exists: "La huella de este dispositivo ya está vinculada.",
    webauthn_verification_failed: "No se pudo comprobar la huella o el PIN.",
  };
  return new Error(messages[error?.code] || messages[error?.message] || error?.message || "No se pudo acceder a tu cuenta.");
}
