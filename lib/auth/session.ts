import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getCurrentClaims() {
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

