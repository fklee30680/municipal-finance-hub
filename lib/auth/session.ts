import { redirect } from "next/navigation";

import { getSupabaseEnvIssue } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  if (getSupabaseEnvIssue()) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getCurrentClaims() {
  if (getSupabaseEnvIssue()) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  return data.claims;
}

export async function requireClaims() {
  const claims = await getCurrentClaims();

  if (!claims) {
    redirect("/login");
  }

  return claims;
}
