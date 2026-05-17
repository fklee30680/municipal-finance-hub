export function getSupabaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl || !isHttpUrl(supabaseUrl)) {
    return null;
  }

  return supabaseUrl;
}

export function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function getSupabaseEnvIssue() {
  if (!getSupabaseUrl()) {
    return "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP or HTTPS URL.";
  }

  if (!getSupabaseAnonKey()) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY is required.";
  }

  return null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
